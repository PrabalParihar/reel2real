import { consumeMetaCalls, DailyCapError } from "@/src/server/daily-cap";
import { dailyCapResponse, guardMetaRoute } from "@/src/server/meta-guard";
import { forwardMuseRequest, museForwardEnabled, musePublicDegrade, museTooLargeResponse, readMuseBody } from "@/src/server/muse-forward";
import { executeSpark, sparkRefusalResponse } from "@/src/server/spark-run";
import { screenSparkInput } from "@/src/safety/goal-screen";
import type { SparkRequest } from "@/src/server/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardMetaRoute(request);
  if (blocked) return blocked;
  const forward = museForwardEnabled(process.env);
  const rawBody = forward ? await readMuseBody(request) : await request.text();
  if (rawBody === null) return museTooLargeResponse();
  let body: SparkRequest;
  try {
    body = JSON.parse(rawBody) as SparkRequest;
  } catch {
    return Response.json({ error: "invalid_json", message: "The request was not JSON." }, { status: 400 });
  }
  // Screen before the daily cap and before any forward or fetch.
  const screened = screenSparkInput(body);
  if (screened) return sparkRefusalResponse(screened.reason);
  if (forward) {
    const reserved = consumeMetaCalls(1);
    if (!reserved.ok) {
      return dailyCapResponse(new DailyCapError(reserved.message))
        ?? Response.json({ error: "daily_cap", message: reserved.message }, { status: 429 });
    }
    return forwardMuseRequest({
      rawBody,
      env: process.env,
      route: "spark",
      contentType: request.headers.get("content-type"),
      forwardedFor: request.headers.get("x-forwarded-for"),
      realIp: request.headers.get("x-real-ip"),
    });
  }
  // A recorded sample is local. It does not call Meta and does not reserve a call.
  if (body.sampleId && !body.transcript?.trim() && !body.videoBase64) {
    return executeSpark(body, { mockSparkDelayMs: 2800 });
  }
  return Response.json(musePublicDegrade(body.videoBase64 ? "clip" : "transcript"));
}

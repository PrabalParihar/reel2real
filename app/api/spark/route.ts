import { consumeMetaCalls, DailyCapError } from "@/src/server/daily-cap";
import { dailyCapResponse, guardMetaRoute } from "@/src/server/meta-guard";
import { forwardMuseRequest, musePublicDegrade, museTooLargeResponse, readMuseBody } from "@/src/server/muse-forward";
import { executeSpark, sparkRefusalResponse } from "@/src/server/spark-run";
import { screenSparkInput } from "@/src/safety/goal-screen";
import { modelExecutionMode } from "@/src/server/model-execution";
import { parseSparkRequest } from "@/src/server/request-validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardMetaRoute(request);
  if (blocked) return blocked;
  const mode = modelExecutionMode(process.env, "spark");
  let rawBody: string | null;
  try { rawBody = await readMuseBody(request); }
  catch { return Response.json({ error: "invalid_request", message: "The request body could not be read." }, { status: 400 }); }
  if (rawBody === null) return museTooLargeResponse();
  const parsed = parseSparkRequest(rawBody);
  if (!parsed.ok) return parsed.response;
  const body = { ...parsed.value, signal: request.signal };
  // Screen before the daily cap and before any forward or fetch.
  const screened = screenSparkInput(body);
  if (screened) return sparkRefusalResponse(screened.reason);
  // Recorded samples stay local even when a live worker or key is configured.
  if (body.sampleId && !body.transcript?.trim() && !body.videoBase64) return executeSpark(body);
  if (mode === "forward") {
    const reserved = consumeMetaCalls(1);
    if (!reserved.ok) {
      return dailyCapResponse(new DailyCapError(reserved.message))
        ?? Response.json({ error: "daily_cap", message: reserved.message }, { status: 429 });
    }
    return forwardMuseRequest({
      rawBody,
      env: process.env,
      route: "spark",
      signal: request.signal,
      contentType: request.headers.get("content-type"),
      forwardedFor: request.headers.get("x-forwarded-for"),
      realIp: request.headers.get("x-real-ip"),
    });
  }
  if (mode === "direct") return executeSpark(body);
  return Response.json(musePublicDegrade(body.videoBase64 ? "clip" : "transcript"));
}

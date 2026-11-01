import { consumeMetaCalls, DailyCapError } from "@/src/server/daily-cap";
import { dailyCapResponse, guardMetaRoute } from "@/src/server/meta-guard";
import { forwardMuseRequest, museForwardEnabled, museTooLargeResponse, readMuseBody } from "@/src/server/muse-forward";
import { executeSpark } from "@/src/server/spark-run";
import type { SparkRequest } from "@/src/server/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardMetaRoute(request);
  if (blocked) return blocked;
  if (museForwardEnabled(process.env)) {
    const rawBody = await readMuseBody(request);
    if (rawBody === null) return museTooLargeResponse();
    try {
      JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "invalid_json", message: "The request was not JSON." }, { status: 400 });
    }
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
  const body = (await request.json()) as SparkRequest;
  return executeSpark(body, { mockSparkDelayMs: 2800 });
}

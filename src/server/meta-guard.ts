import { consumeMetaCalls, DailyCapError } from "./daily-cap";
import { allowMetaRoute, clientIpFromForwarded } from "./ip-limit";

const MAX_SEGMENT_PROMPTS = 4;

export function guardMetaRoute(request: Request): Response | null {
  const ip = clientIpFromForwarded(request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"));
  if (allowMetaRoute(ip)) return null;
  return Response.json(
    { error: "rate_limit", message: "Too many requests from this network. Wait a minute and try again." },
    { status: 429 },
  );
}

export function dailyCapResponse(error: unknown): Response | null {
  if (!(error instanceof DailyCapError)) return null;
  return Response.json({ error: "daily_cap", message: error.message }, { status: 429 });
}

/** Same prompt cap the direct segment call uses: one Meta call per prompt, at most four. */
export function segmentMetaCallCount(rawBody: string): number {
  try {
    const parsed = JSON.parse(rawBody) as { prompts?: unknown };
    const prompts = Array.isArray(parsed.prompts) ? parsed.prompts : [];
    return Math.min(prompts.length, MAX_SEGMENT_PROMPTS);
  } catch {
    return MAX_SEGMENT_PROMPTS;
  }
}

/**
 * Reserve the daily cap for a forwarded segment. A miss returns 429 and does not
 * consume a partial count, so the caller must not forward or call upstream.
 */
export function reserveSegmentCap(rawBody: string): Response | null {
  const count = segmentMetaCallCount(rawBody);
  if (count === 0) return null;
  const result = consumeMetaCalls(count);
  if (result.ok) return null;
  return dailyCapResponse(new DailyCapError(result.message));
}

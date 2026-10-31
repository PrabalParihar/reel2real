import { DailyCapError } from "./daily-cap";
import { allowMetaRoute, clientIpFromForwarded } from "./ip-limit";

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

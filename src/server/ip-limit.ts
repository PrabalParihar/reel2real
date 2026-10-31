export function clientIpFromForwarded(header: string | null): string {
  const first = header?.split(",")[0]?.trim();
  return first || "unknown";
}

export function createIpLimiter(options: { windowMs: number; max: number; now?: () => number }) {
  const hits = new Map<string, number[]>();
  const now = options.now ?? (() => Date.now());
  return {
    allow(ip: string) {
      const time = now();
      const recent = (hits.get(ip) ?? []).filter((stamp) => time - stamp < options.windowMs);
      if (recent.length >= options.max) {
        hits.set(ip, recent);
        return false;
      }
      recent.push(time);
      hits.set(ip, recent);
      return true;
    },
  };
}

/** Preview limit for routes that can call Meta. Not a Meta quota. */
export const META_ROUTE_LIMIT = { windowMs: 60_000, max: 20 };

const shared = createIpLimiter(META_ROUTE_LIMIT);

export function allowMetaRoute(ip: string) {
  return shared.allow(ip);
}

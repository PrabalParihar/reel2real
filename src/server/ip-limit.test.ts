import { describe, expect, it } from "vitest";
import { clientIpFromForwarded, createIpLimiter } from "./ip-limit";

describe("per-IP limit", () => {
  it("reads the first forwarded address", () => {
    expect(clientIpFromForwarded("203.0.113.5, 10.0.0.1")).toBe("203.0.113.5");
    expect(clientIpFromForwarded(null)).toBe("unknown");
  });

  it("blocks the next call after the window fills", () => {
    let now = 1_000;
    const limiter = createIpLimiter({ windowMs: 1000, max: 2, now: () => now });
    expect(limiter.allow("203.0.113.5")).toBe(true);
    expect(limiter.allow("203.0.113.5")).toBe(true);
    expect(limiter.allow("203.0.113.5")).toBe(false);
    expect(limiter.allow("203.0.113.9")).toBe(true);
    now = 2_100;
    expect(limiter.allow("203.0.113.5")).toBe(true);
  });
});

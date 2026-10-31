import { describe, expect, it } from "vitest";
import { createDailyCap, readDailyCap, utcDay } from "./daily-cap";

describe("daily Meta call cap", () => {
  it("defaults to 200 and honors META_DAILY_CALL_CAP", () => {
    expect(readDailyCap({})).toBe(200);
    expect(readDailyCap({ META_DAILY_CALL_CAP: "40" })).toBe(40);
    expect(readDailyCap({ META_DAILY_CALL_CAP: "" })).toBe(200);
  });

  it("stops at the cap and resets at UTC midnight", () => {
    let now = Date.parse("2026-10-31T23:50:00.000Z");
    const cap = createDailyCap({ now: () => now, cap: 2 });
    expect(cap.tryConsume().ok).toBe(true);
    expect(cap.tryConsume().ok).toBe(true);
    const blocked = cap.tryConsume();
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.message).toMatch(/UTC midnight/);
    now = Date.parse("2026-11-01T00:00:00.000Z");
    expect(utcDay(now)).toBe("2026-11-01");
    expect(cap.tryConsume().ok).toBe(true);
  });
});

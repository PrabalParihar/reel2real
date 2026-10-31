export class DailyCapError extends Error {
  readonly code = "daily_cap";

  constructor(message: string) {
    super(message);
    this.name = "DailyCapError";
  }
}

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function readDailyCap(env: Record<string, string | undefined> = process.env): number {
  const raw = env.META_DAILY_CALL_CAP;
  if (raw == null || raw.trim() === "") return 200;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 200;
  return Math.floor(parsed);
}

export function createDailyCap(options?: { now?: () => number; cap?: number | (() => number) }) {
  let day = "";
  let count = 0;
  const now = options?.now ?? (() => Date.now());
  const capOf = () => {
    const value = typeof options?.cap === "function" ? options.cap() : options?.cap;
    return value ?? readDailyCap();
  };
  return {
    tryConsume(amount = 1) {
      const today = utcDay(now());
      if (today !== day) {
        day = today;
        count = 0;
      }
      const cap = capOf();
      if (count + amount > cap) {
        return {
          ok: false as const,
          remaining: Math.max(0, cap - count),
          message: `Daily Meta call cap reached (${cap}). Try again after UTC midnight.`,
        };
      }
      count += amount;
      return { ok: true as const, remaining: cap - count };
    },
  };
}

const shared = createDailyCap();

export function consumeMetaCalls(amount = 1) {
  return shared.tryConsume(amount);
}

import { afterEach, expect, it, vi } from "vitest";
import { modelDeadline } from "./model-deadline";

afterEach(() => vi.useRealTimers());

it("refuses new model work after elapsed time even before the timer callback runs", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const deadline = modelDeadline(100);
  const start = vi.fn(async () => "started");
  try {
    vi.setSystemTime(101);
    await expect(deadline.run(start)).rejects.toMatchObject({ name: "TimeoutError" });
    expect(start).not.toHaveBeenCalled();
  } finally { deadline.close(); }
});

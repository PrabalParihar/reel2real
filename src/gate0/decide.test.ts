import { expect, it } from "vitest";
import { decideGate0, type GateRun } from "./decide";

it("never promotes a failed partial SAM clip result to a passing live clip", () => {
  const partial: GateRun = {
    sam_still_ok: true, sam_still_full_ms: 50,
    sam_clip_ok: false, sam_clip_full_ms: 100, sam_clip_timed_out: false, sam_objects_returned: 3,
    spark_ok: true, spark_latency_ms: 100, spark_json_parse_ok: true, spark_schema_valid: true, steps_count: 3,
  };
  const decision = decideGate0([partial], "live");
  expect(decision.decision).toBe("stills_only");
});

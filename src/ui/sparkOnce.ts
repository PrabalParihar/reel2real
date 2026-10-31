import type { SparkResult } from "@/src/server/types";
import type { PrepareRequest } from "./session";

const inflight = new Map<string, Promise<SparkResult>>();

export function sparkOnce(prepare: PrepareRequest): Promise<SparkResult> {
  const existing = inflight.get(prepare.key);
  if (existing) return existing;
  const promise = fetch("/api/spark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: prepare.transcript,
      title: prepare.title,
      domain: prepare.domain,
      filename: prepare.filename,
      creditLine: prepare.creditLine,
      durationSec: prepare.durationSec,
      sampleId: prepare.sampleId,
    }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Spark failed (HTTP ${response.status}).`);
    return response.json() as Promise<SparkResult>;
  }).catch((error) => {
    inflight.delete(prepare.key);
    throw error;
  });
  inflight.set(prepare.key, promise);
  return promise;
}

import type { SparkResult } from "@/src/server/types";
import type { PrepareRequest } from "./session";

const inflight = new Map<string, Promise<SparkResult>>();

export type ExtractStage = "upload" | "reading" | "validating" | "preparing";

export function postSpark(prepare: PrepareRequest, onStage?: (stage: ExtractStage) => void): Promise<SparkResult> {
  const existing = inflight.get(prepare.key);
  if (existing) return existing;
  const promise = new Promise<SparkResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/spark");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = () => onStage?.(prepare.hasClip ? "upload" : "reading");
    xhr.upload.onload = () => onStage?.("reading");
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        inflight.delete(prepare.key);
        let code = "";
        let message = `Spark failed (HTTP ${xhr.status}).`;
        try {
          const parsed = JSON.parse(xhr.responseText) as { error?: string; message?: string };
          code = parsed.error ?? "";
          if (parsed.message) message = parsed.message;
        } catch {
          code = "";
        }
        const error = new Error(message) as Error & { status?: number; code?: string };
        error.status = xhr.status;
        error.code = code;
        reject(error);
        return;
      }
      resolve(JSON.parse(xhr.responseText) as SparkResult);
    };
    xhr.onerror = () => {
      inflight.delete(prepare.key);
      reject(new Error("Spark did not return steps."));
    };
    onStage?.(prepare.hasClip ? "upload" : "reading");
    xhr.send(JSON.stringify({
      transcript: prepare.transcript,
      title: prepare.title,
      domain: prepare.domain,
      filename: prepare.filename,
      durationSec: prepare.durationSec,
      sampleId: prepare.sampleId,
      videoBase64: prepare.videoBase64,
      mimeType: prepare.mimeType,
      creatorName: prepare.creatorName,
      licenceChoice: prepare.licenceChoice,
      creditLink: prepare.creditLink,
    }));
  });
  inflight.set(prepare.key, promise);
  return promise;
}

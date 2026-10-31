import type { ToolCall, TutorialSteps } from "@/src/schema/types";

export interface CachedSteps {
  tutorial: TutorialSteps;
  toolCalls: ToolCall[];
  inputKind: "clip" | "transcript" | "sample";
}

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("reel2real", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("steps")) db.createObjectStore("steps");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readStepsCache(hash: string): Promise<CachedSteps | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("steps", "readonly");
    const request = tx.objectStore("steps").get(hash);
    request.onsuccess = () => resolve((request.result as CachedSteps | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function writeStepsCache(hash: string, value: CachedSteps): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("steps", "readwrite");
    tx.objectStore("steps").put(value, hash);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

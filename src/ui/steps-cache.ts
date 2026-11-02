import { SPARK_MODEL_ID } from "@/src/models";
import { SCHEMA_VERSION, type ToolCall, type TutorialSteps } from "@/src/schema/types";
import { validateTutorialSteps } from "@/src/schema/validate";
import type { PrepareRequest } from "./session";

export interface CachedSteps {
  tutorial: TutorialSteps;
  toolCalls: ToolCall[];
  inputKind: "clip" | "transcript" | "sample";
  /** Original execution is retained independently of the current runtime configuration. */
  provenance?: { mode: "live" | "mock"; modelId: string | null };
}

const CACHE_VERSION = 2;
const CACHE_PROMPT_VERSION = "spark-steps-v1";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_DEADLINE_MS = 500;

interface CacheEnvelope {
  cacheVersion: typeof CACHE_VERSION;
  schemaVersion: typeof SCHEMA_VERSION;
  promptVersion: typeof CACHE_PROMPT_VERSION;
  modelVersion: typeof SPARK_MODEL_ID;
  createdAt: number;
  expiresAt: number;
  requestIdentity: string;
  value: CachedSteps;
}

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Bump the prompt marker when extraction semantics change; metadata edits intentionally miss. */
function requestIdentity(prepare?: Partial<PrepareRequest>): string {
  return JSON.stringify([
    prepare?.sampleId, prepare?.transcript, prepare?.title, prepare?.domain,
    prepare?.filename, prepare?.durationSec, prepare?.mimeType, prepare?.creatorName,
    prepare?.licenceChoice, prepare?.creditLink, prepare?.hasClip,
  ]);
}

function storageKey(hash: string, identity: string): string {
  return JSON.stringify([CACHE_VERSION, hash, identity]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validToolCall(value: unknown): value is ToolCall {
  if (!isRecord(value)) return false;
  return ["muse_spark", "sam_3_1", "tts", "other"].includes(String(value.tool))
    && typeof value.modelId === "string" && value.modelId.trim().length > 0
    && typeof value.purpose === "string" && value.purpose.trim().length > 0
    && (value.requestId === undefined || typeof value.requestId === "string")
    && (value.inputKind === undefined || ["transcript", "clip", "image", "video_chunk", "text"].includes(String(value.inputKind)))
    && (value.latencyMs === undefined || typeof value.latencyMs === "number" && Number.isFinite(value.latencyMs) && value.latencyMs >= 0);
}

function validatedSteps(value: unknown): CachedSteps | null {
  if (!isRecord(value) || !["clip", "transcript", "sample"].includes(String(value.inputKind))) return null;
  if (!Array.isArray(value.toolCalls) || !value.toolCalls.every(validToolCall)) return null;
  const provenance = value.provenance;
  if (!isRecord(provenance) || !["live", "mock"].includes(String(provenance.mode))) return null;
  if (provenance.modelId !== null && (typeof provenance.modelId !== "string" || !provenance.modelId.trim())) return null;
  if (provenance.mode === "live" && provenance.modelId === null) return null;
  const tutorial = validateTutorialSteps(value.tutorial);
  if (!tutorial.ok || !shouldCacheSteps({ inputKind: String(value.inputKind), tutorial: tutorial.value })) return null;
  return {
    tutorial: tutorial.value,
    toolCalls: structuredClone(value.toolCalls) as ToolCall[],
    inputKind: value.inputKind as CachedSteps["inputKind"],
    provenance: { mode: provenance.mode as "live" | "mock", modelId: provenance.modelId as string | null },
  };
}

function validatedEnvelope(value: unknown, identity: string): CachedSteps | null {
  if (!isRecord(value)) return null;
  const now = Date.now();
  if (value.cacheVersion !== CACHE_VERSION || value.schemaVersion !== SCHEMA_VERSION
    || value.promptVersion !== CACHE_PROMPT_VERSION || value.modelVersion !== SPARK_MODEL_ID
    || value.requestIdentity !== identity
    || typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt) || value.createdAt > now
    || typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt) || value.expiresAt <= now
    || value.expiresAt > value.createdAt + CACHE_MAX_AGE_MS) return null;
  return validatedSteps(value.value);
}

/** All storage failures are optional misses. The single deadline includes open and transaction. */
function withDatabase<T>(fallback: T, operation: (db: IDBDatabase, done: (value: T) => void) => IDBTransaction): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    let db: IDBDatabase | undefined;
    let tx: IDBTransaction | undefined;
    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { db?.close(); } catch { /* Closing storage cannot block recovery. */ }
      resolve(value);
    };
    const timer = setTimeout(() => {
      finish(fallback);
      try { tx?.abort(); } catch { /* A completed transaction has nothing left to cancel. */ }
    }, STORAGE_DEADLINE_MS);
    try {
      if (typeof indexedDB === "undefined") { finish(fallback); return; }
      const request = indexedDB.open("reel2real", 1);
      request.onupgradeneeded = () => {
        if (settled) { request.result.close(); return; }
        try {
          if (!request.result.objectStoreNames.contains("steps")) request.result.createObjectStore("steps");
        } catch { finish(fallback); }
      };
      request.onblocked = () => finish(fallback);
      request.onerror = () => finish(fallback);
      request.onsuccess = () => {
        db = request.result;
        if (settled) { db.close(); return; }
        db.onversionchange = () => { finish(fallback); };
        try { tx = operation(db, finish); } catch { finish(fallback); }
      };
    } catch { finish(fallback); }
  });
}

export async function readStepsCache(hash: string, prepare?: Partial<PrepareRequest>): Promise<CachedSteps | null> {
  const identity = requestIdentity(prepare);
  return withDatabase<CachedSteps | null>(null, (db, done) => {
    const tx = db.transaction("steps", "readonly");
    const request = tx.objectStore("steps").get(storageKey(hash, identity));
    request.onsuccess = () => {
      try { done(validatedEnvelope(request.result, identity)); } catch { done(null); }
    };
    request.onerror = () => done(null);
    tx.onerror = () => done(null);
    tx.onabort = () => done(null);
    return tx;
  });
}

/** A still stand-in is not a clip, so it never lands in the clip cache. */
export function shouldCacheSteps(value: { inputKind: string; tutorial: { sourceClip?: { stillPlaceholder?: boolean } } }): boolean {
  if (value.tutorial.sourceClip?.stillPlaceholder === true) return false;
  return value.inputKind === "clip" || value.inputKind === "transcript" || value.inputKind === "sample";
}

export async function writeStepsCache(hash: string, value: CachedSteps, prepare?: Partial<PrepareRequest>): Promise<boolean> {
  let validated: CachedSteps | null;
  try { validated = validatedSteps(value); } catch { return false; }
  if (!validated) return false;
  const identity = requestIdentity(prepare);
  const now = Date.now();
  const envelope: CacheEnvelope = {
    cacheVersion: CACHE_VERSION, schemaVersion: SCHEMA_VERSION,
    promptVersion: CACHE_PROMPT_VERSION, modelVersion: SPARK_MODEL_ID,
    createdAt: now, expiresAt: now + CACHE_MAX_AGE_MS, requestIdentity: identity, value: validated,
  };
  return withDatabase<boolean>(false, (db, done) => {
    const tx = db.transaction("steps", "readwrite");
    const request = tx.objectStore("steps").put(envelope, storageKey(hash, identity));
    request.onerror = () => done(false);
    tx.oncomplete = () => done(true);
    tx.onerror = () => done(false);
    tx.onabort = () => done(false);
    return tx;
  });
}

/** Clears both versioned and obsolete entries without deleting the database. */
export async function clearStepsCache(): Promise<boolean> {
  return withDatabase<boolean>(false, (db, done) => {
    const tx = db.transaction("steps", "readwrite");
    const request = tx.objectStore("steps").clear();
    request.onerror = () => done(false);
    tx.oncomplete = () => done(true);
    tx.onerror = () => done(false);
    tx.onabort = () => done(false);
    return tx;
  });
}

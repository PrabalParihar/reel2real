import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import { SPARK_MODEL_ID } from "@/src/models";
import { clearStepsCache, readStepsCache, sha256Hex, writeStepsCache, type CachedSteps } from "./steps-cache";

/** Small IndexedDB double: operations run asynchronously through the IDB event paths. */
function storageDouble(mode: "ok" | "throw" | "blocked" | "stall" | "quota" | "abort" = "ok") {
  const entries = new Map<IDBValidKey, unknown>();
  let closed = 0;
  let openRequest: Record<string, any>;
  const database = {
    close() { closed += 1; },
    objectStoreNames: { contains: () => true },
    transaction() {
      const tx: Record<string, any> = {
        abort() { tx.onabort?.(); },
        objectStore() {
          return {
            get(key: IDBValidKey) {
              const request: Record<string, any> = {};
              if (mode !== "stall") queueMicrotask(() => {
                if (mode === "abort") tx.onabort?.();
                else { request.result = entries.get(key); request.onsuccess?.(); }
              });
              return request;
            },
            clear() {
              const request: Record<string, any> = {};
              if (mode !== "stall") queueMicrotask(() => {
                if (mode === "quota") tx.onerror?.();
                else if (mode === "abort") tx.onabort?.();
                else { entries.clear(); tx.oncomplete?.(); }
              });
              return request;
            },
            put(value: unknown, key: IDBValidKey) {
              const request: Record<string, any> = {};
              if (mode !== "stall") queueMicrotask(() => {
                if (mode === "quota") tx.onerror?.();
                else if (mode === "abort") tx.onabort?.();
                else { entries.set(key, structuredClone(value)); tx.oncomplete?.(); }
              });
              return request;
            },
          };
        },
      };
      return tx;
    },
  };
  const idb = {
    open() {
      if (mode === "throw") throw new DOMException("Storage blocked", "SecurityError");
      const request: Record<string, any> = {};
      openRequest = request;
      if (mode === "blocked") queueMicrotask(() => request.onblocked?.());
      else queueMicrotask(() => { request.result = database; request.onsuccess?.(); });
      return request;
    },
  };
  vi.stubGlobal("indexedDB", idb);
  return { entries, get closed() { return closed; }, lateOpen() { openRequest.result = database; openRequest.onsuccess?.(); } };
}

function value(): CachedSteps {
  return {
    tutorial: structuredClone(PUBLISHED_SAMPLES[0].tutorial),
    toolCalls: [],
    inputKind: "clip",
    provenance: { mode: "mock", modelId: SPARK_MODEL_ID },
  } as CachedSteps;
}

const metadata = { title: "Current lesson", creatorName: "Current creator", domain: "other" as const, transcript: "Stir gently", licenceChoice: "self_filmed" as const, hasClip: true };

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("clip hash", () => {
  it("is SHA-256 of the file bytes", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("optional steps cache", () => {
  it("ignores missing IndexedDB", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(writeStepsCache("hash", value())).resolves.toBe(false);
    await expect(readStepsCache("hash")).resolves.toBeNull();
  });

  it("preserves source provenance and closes each successful connection", async () => {
    const storage = storageDouble();
    await expect(writeStepsCache("hash", value(), metadata)).resolves.toBe(true);
    const cached = await readStepsCache("hash", metadata);
    expect(cached).toEqual(value());
    expect(cached?.provenance).toEqual({ mode: "mock", modelId: SPARK_MODEL_ID });
    expect(storage.closed).toBe(2);
  });

  it.each(["title", "creatorName", "domain", "transcript", "creditLink", "licenceChoice", "filename", "durationSec", "mimeType", "sampleId"])("does not reuse changed %s metadata", async (field) => {
    storageDouble();
    await writeStepsCache("hash", value(), metadata);
    await expect(readStepsCache("hash", { ...metadata, [field]: "changed" })).resolves.toBeNull();
  });

  it("ignores legacy unversioned output rather than promoting its unknown execution mode", async () => {
    const storage = storageDouble();
    storage.entries.set("hash", { tutorial: value().tutorial, toolCalls: [], inputKind: "clip" });
    await expect(readStepsCache("hash")).resolves.toBeNull();
  });

  it.each(["cacheVersion", "schemaVersion", "promptVersion", "modelVersion", "expiresAt"])("rejects an obsolete %s envelope", async (field) => {
    const storage = storageDouble();
    await writeStepsCache("hash", value(), metadata);
    const [key, envelope] = [...storage.entries][0];
    (envelope as Record<string, unknown>)[field] = field === "expiresAt" ? 0 : "obsolete";
    storage.entries.set(key, envelope);
    await expect(readStepsCache("hash", metadata)).resolves.toBeNull();
  });

  it.each(["tutorial", "toolCalls", "inputKind", "provenance"])("rejects invalid cached %s", async (field) => {
    const storage = storageDouble();
    await writeStepsCache("hash", value(), metadata);
    const [key, envelope] = [...storage.entries][0];
    const record = envelope as Record<string, any>;
    (record.value ?? record)[field] = field === "toolCalls" ? [{ tool: "invented" }] : "invalid";
    storage.entries.set(key, envelope);
    await expect(readStepsCache("hash", metadata)).resolves.toBeNull();
  });

  it("does not write output without execution provenance", async () => {
    const storage = storageDouble();
    const output = value();
    delete output.provenance;
    await writeStepsCache("hash", output);
    expect(storage.entries.size).toBe(0);
  });

  it("never caches instruction still stand-ins as clips", async () => {
    const storage = storageDouble();
    const output = value();
    output.tutorial.sourceClip.stillPlaceholder = true;
    await writeStepsCache("hash", output);
    expect(storage.entries.size).toBe(0);
  });

  it.each(["throw", "quota", "abort"] as const)("survives %s storage failure", async (mode) => {
    storageDouble(mode);
    await expect(writeStepsCache("hash", value())).resolves.toBe(false);
    await expect(readStepsCache("hash")).resolves.toBeNull();
  });

  it("treats a blocked open as a miss and closes a late database", async () => {
    const storage = storageDouble("blocked");
    await expect(readStepsCache("hash")).resolves.toBeNull();
    storage.lateOpen();
    expect(storage.closed).toBe(1);
  });

  it("bounds stalled read and write transactions", async () => {
    vi.useFakeTimers();
    const storage = storageDouble("stall");
    const read = readStepsCache("hash");
    const write = writeStepsCache("hash", value());
    await vi.advanceTimersByTimeAsync(501);
    await expect(read).resolves.toBeNull();
    await expect(write).resolves.toBe(false);
    expect(storage.closed).toBe(2);
  });

  it("clears both current and legacy entries and closes the database", async () => {
    const storage = storageDouble();
    await writeStepsCache("hash", value(), metadata);
    storage.entries.set("legacy", {});
    await expect(clearStepsCache()).resolves.toBe(true);
    expect(storage.entries.size).toBe(0);
    expect(storage.closed).toBe(2);
    await expect(readStepsCache("hash", metadata)).resolves.toBeNull();
  });

  it.each(["throw", "quota", "abort", "blocked"] as const)("reports unsuccessful clear after %s", async (mode) => {
    storageDouble(mode);
    await expect(clearStepsCache()).resolves.toBe(false);
  });

  it("bounds a stalled clear and closes the database", async () => {
    vi.useFakeTimers();
    const storage = storageDouble("stall");
    const clearing = clearStepsCache();
    await vi.advanceTimersByTimeAsync(501);
    await expect(clearing).resolves.toBe(false);
    expect(storage.closed).toBe(1);
  });
});

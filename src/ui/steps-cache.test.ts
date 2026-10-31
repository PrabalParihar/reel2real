import { describe, expect, it } from "vitest";
import { sha256Hex } from "./steps-cache";

describe("clip hash", () => {
  it("is SHA-256 of the file bytes", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UploadScreen } from "./UploadScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }) }));
vi.mock("./session", () => ({ useSession: () => ({
  runtime: { mock: true, capabilities: { spark: false, instruct: false, segment: false } },
  prepare: { hasClip: true, filename: "lesson.mp4", videoBase64: "AAAA", creatorName: "Original creator", licenceChoice: "permission_granted", domain: "non_cooking_diy" },
  videoUrl: "blob:prior-clip", stepsSource: null,
}) }));

describe("upload entry", () => {
  it("preserves editable upload metadata and exposes selected native permission state", () => {
    const html = renderToStaticMarkup(createElement(UploadScreen));
    expect(html).toContain('value="Original creator"');
    expect(html).toMatch(/<input[^>]+type="radio"[^>]+(?:checked=""[^>]+value="permission_granted"|value="permission_granted"[^>]+checked="")/);
  });

  it("puts recorded samples before upload form work and explains known unavailable extraction", () => {
    const html = renderToStaticMarkup(createElement(UploadScreen));
    expect(html.indexOf('class="sample-grid"')).toBeLessThan(html.indexOf('class="drop'));
    expect(html).toContain("Clip extraction is unavailable in this environment");
    expect(html).toContain("16 MB");
    expect(html).toContain("2 minutes");
  });
});

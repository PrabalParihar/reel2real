/** @vitest-environment happy-dom */
import { act, createElement, useEffect, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleByPublishedId } from "@/src/domains/catalog";
import { SessionProvider, useSession } from "./session";
import { CoachScreen } from "./CoachScreen";
import { ExtractingScreen } from "./ExtractingScreen";

const { replace, push, sampleQuery, postSpark } = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  sampleQuery: { value: "" },
  postSpark: vi.fn(),
}));

vi.mock("./sparkOnce", () => ({
  postSpark: (...args: unknown[]) => postSpark(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(sampleQuery.value),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));

function DeferredTutorial() {
  const session = useSession();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  useEffect(() => {
    Promise.resolve().then(() => {
      const sample = sampleByPublishedId("masala-chai");
      if (!sample) return;
      sessionRef.current.setTutorial(sample.tutorial, 0, [], "sample");
    });
  }, []);
  return createElement(CoachScreen);
}

describe("coach hydration race", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
    sampleQuery.value = "";
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("does not redirect while a deferred tutorial commit is still landing", async () => {
    await act(async () => {
      root.render(createElement(SessionProvider, null, createElement(DeferredTutorial)));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(replace).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Set out the mortar and pestle");
  });

  it("redirects a hydrated session that has no tutorial and no sample", async () => {
    await act(async () => {
      root.render(createElement(SessionProvider, null, createElement(CoachScreen)));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(replace).toHaveBeenCalledWith("/upload");
    expect(host.textContent).not.toContain("Set out the mortar and pestle");
  });

  it("opens the coach from a sample id when the session is empty", async () => {
    sampleQuery.value = "sample=masala-chai";
    await act(async () => {
      root.render(createElement(SessionProvider, null, createElement(CoachScreen)));
      await Promise.resolve();
    });
    expect(replace).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Set out the mortar and pestle");
  });

  it("redirects an invalid sample id", async () => {
    sampleQuery.value = "sample=not-a-sample";
    await act(async () => {
      root.render(createElement(SessionProvider, null, createElement(CoachScreen)));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(replace).toHaveBeenCalledWith("/upload");
  });

  it("navigates the spark handoff once when the session object changes", async () => {
    let finishRuntime: (value: unknown) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => {
      finishRuntime = resolve;
    })));
    const tutorial = sampleByPublishedId("masala-chai")!.tutorial;
    postSpark.mockReset();
    postSpark.mockResolvedValue({
      schemaValid: true,
      tutorial,
      latencyMs: 4,
      toolCalls: [],
      inputKind: "sample",
      refused: false,
      mode: "mock",
      modelId: null,
      errors: [],
    });
    sampleQuery.value = "demo=masala-chai";
    await act(async () => {
      root.render(createElement(SessionProvider, null, createElement(ExtractingScreen)));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/coach?sample=masala-chai");
    await act(async () => {
      finishRuntime({ mock: false, sparkModelId: "spark", samModelId: "sam" });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(push).toHaveBeenCalledTimes(1);
  });
});

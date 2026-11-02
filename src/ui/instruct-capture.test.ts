/** @vitest-environment happy-dom */
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAMERA_FAILED_COPY, CAMERA_FRAME_TIMEOUT_MS, CAMERA_STARTING_LABEL } from "./instruct-flow";
import { SAMPLES_HREF } from "./LiveCoachingOff";
import { InstructScreen } from "./InstructScreen";
import { SessionProvider } from "./session";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

function makeStream(): MediaStream {
  const stream = new MediaStream();
  Object.assign(stream, { getTracks: () => [{ stop() {} }] });
  return stream;
}

function buttonNamed(host: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll("button")].find((node) => node.textContent === name);
}

function setFrame(video: HTMLVideoElement, readyState: number, videoWidth: number) {
  Object.defineProperty(video, "readyState", { configurable: true, value: readyState });
  Object.defineProperty(video, "videoWidth", { configurable: true, value: videoWidth });
  Object.defineProperty(video, "videoHeight", { configurable: true, value: videoWidth > 0 ? 480 : 0 });
}

describe("instruct capture still", () => {
  let root: Root;
  let host: HTMLDivElement;
  let requests: Array<{ resolve: (stream: MediaStream) => void; reject: (error: unknown) => void }>;
  const realSetTimeout = window.setTimeout.bind(window);
  const realClearTimeout = window.clearTimeout.bind(window);

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    requests = [];
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(() => new Promise((resolve, reject) => {
          requests.push({ resolve, reject });
        })),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount() {
    await act(async () => {
      root.render(createElement(SessionProvider, null, createElement(InstructScreen)));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function allowCamera() {
    await act(async () => {
      buttonNamed(host, "Allow camera")!.click();
    });
    const pending = requests.at(-1);
    if (!pending) throw new Error("camera was not requested");
    return pending;
  }

  async function grantCamera() {
    const pending = await allowCamera();
    await act(async () => {
      pending.resolve(makeStream());
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function captureButton(): HTMLButtonElement {
    const button = buttonNamed(host, CAMERA_STARTING_LABEL) ?? buttonNamed(host, "Capture still");
    if (!button) throw new Error(`capture button missing: ${host.textContent}`);
    return button;
  }

  it("keeps Capture disabled with Camera starting and aria-disabled before the video is ready", async () => {
    await mount();
    await grantCamera();
    const button = captureButton();
    expect(button.textContent).toBe(CAMERA_STARTING_LABEL);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    const status = host.querySelector("[aria-live='polite']");
    expect(status?.classList.contains("visually-hidden")).toBe(true);
    expect(status?.textContent).toContain(CAMERA_STARTING_LABEL);
    expect(host.querySelector(".instruct-starting")?.textContent).toContain(CAMERA_STARTING_LABEL);
    expect([...host.querySelectorAll(".form-note")].some((node) => node.textContent === CAMERA_STARTING_LABEL)).toBe(false);
    expect(host.textContent).toContain("Live coach");
    expect(host.textContent).not.toMatch(/no tutorial/i);
    expect(host.textContent).not.toContain(CAMERA_FAILED_COPY);
  });

  it("enables Capture after loadeddata when the frame has a width", async () => {
    await mount();
    await grantCamera();
    const video = host.querySelector("video");
    expect(video).toBeTruthy();
    setFrame(video!, 2, 0);
    await act(async () => {
      video!.dispatchEvent(new Event("loadeddata"));
    });
    expect(captureButton().textContent).toBe(CAMERA_STARTING_LABEL);
    expect(captureButton().disabled).toBe(true);

    setFrame(video!, 2, 640);
    await act(async () => {
      video!.dispatchEvent(new Event("loadeddata"));
    });
    const button = captureButton();
    expect(button.textContent).toBe("Capture still");
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(host.querySelector("[aria-live='polite']")?.textContent ?? "").not.toContain(CAMERA_STARTING_LABEL);
    expect(host.querySelector(".instruct-starting")).toBeNull();
  });

  it.each(["loadedmetadata", "canplay", "resize"])("enables Capture from the %s event once a frame has a width", async (eventName) => {
    await mount();
    await grantCamera();
    const video = host.querySelector("video")!;
    setFrame(video, 2, 640);
    await act(async () => {
      video.dispatchEvent(new Event(eventName));
    });
    expect(captureButton().textContent).toBe("Capture still");
    expect(captureButton().disabled).toBe(false);
  });

  it("enables Capture when the video is already ready before a listener can see an event", async () => {
    const proto = HTMLMediaElement.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, "srcObject");
    Object.defineProperty(proto, "srcObject", {
      configurable: true,
      get() {
        return original?.get?.call(this);
      },
      set(value: MediaStream) {
        original?.set?.call(this, value);
        setFrame(this as HTMLVideoElement, 2, 640);
      },
    });
    try {
      await mount();
      await grantCamera();
      const button = captureButton();
      expect(button.textContent).toBe("Capture still");
      expect(button.disabled).toBe(false);
      expect(host.textContent).not.toContain(CAMERA_FAILED_COPY);
    } finally {
      if (original) Object.defineProperty(proto, "srcObject", original);
    }
  });

  it("shows the camera error and the Sample CTA when permission is denied", async () => {
    await mount();
    expect(host.textContent).toContain("Enter a goal, then capture one still.");
    const pending = await allowCamera();
    await act(async () => {
      pending.reject(new DOMException("Permission denied", "NotAllowedError"));
      await Promise.resolve();
      await Promise.resolve();
    });
    const panel = host.querySelector(".error-panel");
    expect(panel?.querySelector("h2")?.textContent).toBe("Camera didn't start");
    expect(panel?.querySelector("p")?.textContent).toBe(CAMERA_FAILED_COPY);
    expect(CAMERA_FAILED_COPY).toBe("You can try again or watch a recorded Sample.");
    const sample = host.querySelector(`a[href="${SAMPLES_HREF}"]`);
    expect(sample?.textContent).toBe("Try a Sample");
    expect(sample?.classList.contains("btn-ghost")).toBe(true);
    expect(sample?.classList.contains("btn-primary")).toBe(false);
    const again = buttonNamed(host, "Try again");
    expect(again?.classList.contains("btn-primary")).toBe(true);
    expect(host.textContent).not.toContain("Enter a goal, then capture one still.");
    expect(buttonNamed(host, "Capture still")).toBeUndefined();
    expect(buttonNamed(host, CAMERA_STARTING_LABEL)).toBeUndefined();
  });

  it("shows the camera error and the Sample CTA when no frame arrives within 8 seconds", async () => {
    const armed = new Map<number, TimerHandler>();
    let seq = 1;
    vi.spyOn(window, "setTimeout").mockImplementation(((fn: TimerHandler, ms?: number, ...rest: unknown[]) => {
      if (ms === CAMERA_FRAME_TIMEOUT_MS) {
        const id = seq++;
        armed.set(id, fn);
        return id;
      }
      return realSetTimeout(fn as never, ms as number, ...(rest as []));
    }) as typeof window.setTimeout);
    vi.spyOn(window, "clearTimeout").mockImplementation(((id?: number) => {
      if (typeof id === "number" && armed.has(id)) {
        armed.delete(id);
        return;
      }
      realClearTimeout(id);
    }) as typeof window.clearTimeout);

    await mount();
    await grantCamera();
    expect(armed.size).toBe(1);
    expect(captureButton().disabled).toBe(true);
    await act(async () => {
      for (const fn of armed.values()) if (typeof fn === "function") fn();
      armed.clear();
    });
    expect(host.textContent).toContain(CAMERA_FAILED_COPY);
    expect(host.querySelector(`a[href="${SAMPLES_HREF}"]`)?.classList.contains("btn-ghost")).toBe(true);
    expect(host.textContent).not.toContain("Enter a goal, then capture one still.");
    expect(buttonNamed(host, "Try again")?.classList.contains("btn-primary")).toBe(true);
  });

  it("clears the frame timer once a frame is ready so the error does not appear later", async () => {
    const armed = new Map<number, TimerHandler>();
    let seq = 1;
    vi.spyOn(window, "setTimeout").mockImplementation(((fn: TimerHandler, ms?: number, ...rest: unknown[]) => {
      if (ms === CAMERA_FRAME_TIMEOUT_MS) {
        const id = seq++;
        armed.set(id, fn);
        return id;
      }
      return realSetTimeout(fn as never, ms as number, ...(rest as []));
    }) as typeof window.setTimeout);
    vi.spyOn(window, "clearTimeout").mockImplementation(((id?: number) => {
      if (typeof id === "number" && armed.has(id)) {
        armed.delete(id);
        return;
      }
      realClearTimeout(id);
    }) as typeof window.clearTimeout);

    await mount();
    await grantCamera();
    expect(armed.size).toBe(1);
    const video = host.querySelector("video")!;
    setFrame(video, 2, 640);
    await act(async () => {
      video.dispatchEvent(new Event("loadeddata"));
    });
    expect(armed.size).toBe(0);
    expect(captureButton().textContent).toBe("Capture still");
    await act(async () => {
      for (const fn of armed.values()) if (typeof fn === "function") fn();
    });
    expect(host.textContent).not.toContain(CAMERA_FAILED_COPY);
    expect(captureButton().disabled).toBe(false);
  });

  it("asks for the camera again from Try again", async () => {
    await mount();
    const pending = await allowCamera();
    await act(async () => {
      pending.reject(new DOMException("Permission denied", "NotAllowedError"));
      await Promise.resolve();
      await Promise.resolve();
    });
    const asked = requests.length;
    await act(async () => {
      buttonNamed(host, "Try again")!.click();
    });
    expect(requests.length).toBe(asked + 1);
    await act(async () => {
      requests.at(-1)!.resolve(makeStream());
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(captureButton().textContent).toBe(CAMERA_STARTING_LABEL);
    expect(host.textContent).not.toContain(CAMERA_FAILED_COPY);
  });

  it("routes a play rejection to the camera error when no frame arrived", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.reject(new Error("play failed")));
    await mount();
    await grantCamera();
    expect(host.textContent).toContain(CAMERA_FAILED_COPY);
    expect(host.querySelector(`a[href="${SAMPLES_HREF}"]`)?.textContent).toBe("Try a Sample");
    expect(buttonNamed(host, CAMERA_STARTING_LABEL)).toBeUndefined();
  });
});

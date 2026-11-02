"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { readableChipColor } from "@/src/ui/chip-color";
import { durationChipLabel } from "@/src/ui/duration-chip";
import { LABEL_CLEARANCE, maskBoxInView, placeAnchoredLabels, type LabelRect } from "@/src/ui/label-place";
import { clipPathToRect, framePathFromPayload, MASK_FRAME, SAMPLE_STILL, scaleFrameBox, sharedStillRect, visibleFrameRect, type CoverTransform, type FrameBox, type MaskDraw, type ObjectPosition } from "@/src/samples/mask-geometry";
import {
  RECORDED_SAM_LABEL,
  SAM_FRAME,
  selectMaskRecord,
  uniqueByNoun,
  type SamStepFile,
  type SceneNoun,
} from "@/src/samples/scene";

export interface OverlayRequest {
  samUrl: string;
  nouns: SceneNoun[];
}

interface DrawItem {
  key: string;
  noun: string;
  color: string;
  draw: MaskDraw;
  frameW: number;
  frameH: number;
  box: FrameBox;
}

export function RecordedOutlineLayer({
  items,
  clipRect,
  stillScale,
  glowId,
}: {
  items: DrawItem[];
  clipRect: FrameBox | null;
  stillScale: number;
  glowId: string;
}) {
  return (
    <>
      {items.map((item) => {
        const d = clipRect ? clipPathToRect(item.draw.d, clipRect) : item.draw.d;
        if (!d) return null;
        return (
          <g key={item.key} data-noun={item.noun} data-object-id={item.key}>
            <path d={d} fill={item.color} fillOpacity={0.2} stroke="none" />
            <path d={d} fill="none" stroke={item.color} strokeWidth={14 * stillScale} strokeLinejoin="round" strokeLinecap="round" strokeOpacity={0.55} filter={`url(#${glowId})`} />
            <path d={d} fill="none" stroke={item.color} strokeWidth={4.5 * stillScale} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}
    </>
  );
}

function boxFullyInside(box: FrameBox, view: FrameBox): boolean {
  return box.x1 >= view.x1 - 0.5 && box.y1 >= view.y1 - 0.5 && box.x2 <= view.x2 + 0.5 && box.y2 <= view.y2 + 0.5;
}

/** Outer painted contour. The 4.5 core sits inside this glow stroke. */
const OUTLINE_STROKE = 14;
/** feGaussianBlur stdDeviation on that glow. */
const OUTLINE_GLOW = 6;
/** Pull the path in by the glow stroke plus the blur so overflow does not clip it. */
export const EDGE_STROKE_INSET = OUTLINE_STROKE + OUTLINE_GLOW;

function statusRect(text: string, viewW: number, viewH: number, bottom: number): LabelRect {
  const textWidth = text.length * 7;
  const innerMax = Math.max(40, viewW - 46);
  const lines = Math.max(1, Math.ceil(textWidth / innerMax));
  const width = Math.min(viewW - 24, textWidth + 22);
  const height = lines * 18 + 14;
  const pad = LABEL_CLEARANCE;
  return {
    x1: Math.max(0, 12 - pad),
    y1: viewH - bottom - height - pad,
    x2: Math.min(viewW, 12 + width + pad),
    y2: Math.min(viewH, viewH - bottom + pad),
  };
}

function placeLabels(
  items: DrawItem[],
  frameW: number,
  frameH: number,
  cover: CoverTransform,
  view: { w: number; h: number },
  status: LabelRect | null,
): Array<{ key: string; noun: string; color: string; x: number; y: number }> {
  const targets = items.flatMap((item) => {
    const box = maskBoxInView(item.box, frameW, frameH, cover, view.w, view.h);
    if (!box) return [];
    return [{ key: item.key, noun: item.noun, color: readableChipColor(item.color), box }];
  });
  return placeAnchoredLabels({
    viewW: view.w,
    viewH: view.h,
    targets,
    blocked: status ? [status] : [],
  });
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

export function PhotoFrame({
  src,
  alt,
  sizes: _sizes = "(max-width: 800px) 100vw, 640px",
  overlay,
  recordedLabel = false,
  sampleChip = false,
  priority: _priority = false,
  className = "",
  loopSrc,
  objectPosition = { x: 0.5, y: 0.5 },
  zoom = 1,
  status,
  showProgress = false,
  durationSec,
  drawOutlines = true,
  labelMode = "centroid",
}: {
  src: string;
  alt: string;
  sizes?: string;
  overlay?: OverlayRequest | null;
  recordedLabel?: boolean;
  sampleChip?: boolean;
  priority?: boolean;
  className?: string;
  loopSrc?: string;
  objectPosition?: ObjectPosition;
  zoom?: number;
  status?: string | null;
  showProgress?: boolean;
  /** Stored loop length. The chip does not wait on a media event. */
  durationSec?: number;
  /** False drops every contour. A partial outline is never drawn. */
  drawOutlines?: boolean;
  /** Tags sit in a row on the card. Centroid chips float on the object. */
  labelMode?: "centroid" | "tags";
}) {
  const glowId = useId().replace(/:/g, "");
  const [view, setView] = useState({ w: 0, h: 0 });
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [items, setItems] = useState<DrawItem[]>([]);
  const [reduced, setReduced] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [clock, setClock] = useState("0:00");
  const durationLabel = durationChipLabel(durationSec);
  const nounKey = (overlay?.nouns ?? []).map((noun) => `${noun.objectId}:${noun.requestId ?? ""}:${noun.present ? 1 : 0}`).join("|");
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useLayoutEffect(() => {
    if (!host) return;
    const apply = () => {
      const rect = host.getBoundingClientRect();
      setView({ w: rect.width, h: rect.height });
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(host);
    return () => observer.disconnect();
  }, [host]);

  useEffect(() => {
    const current = overlayRef.current;
    if (!current?.samUrl || !current.nouns.length) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const nouns = current.nouns;
    fetch(current.samUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("recorded sam missing");
        return response.json() as Promise<SamStepFile>;
      })
      .then((file) => {
        if (controller.signal.aborted) return;
        const next: DrawItem[] = [];
        for (const noun of nouns) {
          const selected = selectMaskRecord(file.calls, noun);
          if (!selected) continue;
          try {
            const frameW = selected.box.frameW || SAM_FRAME.width;
            const frameH = selected.box.frameH || SAM_FRAME.height;
            const imageBox = scaleFrameBox(selected.box, frameW, frameH, SAMPLE_STILL.width, SAMPLE_STILL.height);
            const draw = framePathFromPayload(selected.mask, imageBox);
            if (!draw.d) continue;
            next.push({
              key: noun.objectId,
              noun: noun.noun,
              color: noun.color || "#2dd4bf",
              draw,
              frameW: SAMPLE_STILL.width,
              frameH: SAMPLE_STILL.height,
              box: imageBox,
            });
          } catch {
            // A bad payload stays empty. Never fall back to a box.
          }
        }
        setItems(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      });
    return () => controller.abort();
  }, [nounKey, overlay?.samUrl]);

  const frameW = SAMPLE_STILL.width;
  const frameH = SAMPLE_STILL.height;
  const stillScale = frameW / MASK_FRAME.width;
  const cover: CoverTransform | null = view.w > 0 && view.h > 0
    ? sharedStillRect(view.w, view.h, objectPosition, zoom)
    : null;
  const showRecorded = recordedLabel && !status;
  const statusText = status ? status : showRecorded ? RECORDED_SAM_LABEL : sampleChip ? "Sample" : null;
  const playLoop = Boolean(loopSrc) && !reduced;
  const gapBelow = cover ? view.h - (cover.top + cover.height) : 0;
  const mediaBottom = gapBelow > 8 ? gapBelow + 14 : 16;
  const visible = cover ? visibleFrameRect(frameW, frameH, view.w, view.h, cover) : null;
  const strokeInset = EDGE_STROKE_INSET * stillScale;
  const clipRect = visible
    ? {
        x1: visible.x1 + strokeInset,
        y1: visible.y1 + strokeInset,
        x2: visible.x2 - strokeInset,
        y2: visible.y2 - strokeInset,
      }
    : null;

  return (
    <div className={`photo-frame${labelMode === "tags" ? " has-tags" : ""}${className ? ` ${className}` : ""}`} ref={setHost}>
      <div
        className="photo-cover"
        style={cover
          ? { left: cover.left, top: cover.top, width: cover.width, height: cover.height }
          : undefined}
      >
        {playLoop ? (
          <video
            className="reel-media"
            src={loopSrc}
            poster={src}
            muted
            loop
            playsInline
            autoPlay
            style={{ objectFit: "fill", maxWidth: "none" }}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              if (!video.duration) return;
              setRatio(video.currentTime / video.duration);
              setClock(formatClock(video.currentTime));
            }}
          />
        ) : null}
        <svg className="mask-svg" viewBox={`0 0 ${frameW} ${frameH}`} preserveAspectRatio="none" role="img" aria-label={playLoop ? undefined : alt}>
          <defs>
            <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={6 * stillScale} />
            </filter>
          </defs>
          {playLoop ? null : (
            <image href={src} x="0" y="0" width={frameW} height={frameH} preserveAspectRatio="none" />
          )}
          <RecordedOutlineLayer
            items={drawOutlines ? items.filter((item) => !visible || boxFullyInside(item.box, visible)) : []}
            clipRect={clipRect}
            stillScale={stillScale}
            glowId={glowId}
          />
        </svg>
      </div>
      {labelMode === "tags" ? (
        <div className="noun-tags">
          {uniqueByNoun((overlay?.nouns ?? []).filter((noun) => noun.present)).map((noun) => (
            <span key={noun.objectId} className="noun-chip" style={{ borderColor: readableChipColor(noun.color), color: readableChipColor(noun.color) }}>{noun.noun}</span>
          ))}
        </div>
      ) : cover ? placeLabels(items, frameW, frameH, cover, view, statusText ? statusRect(statusText, view.w, view.h, mediaBottom) : null).map((label) => (
          <span
            key={label.key}
            className="noun-chip"
            style={{
              left: label.x,
              top: label.y,
              borderColor: label.color,
              color: label.color,
            }}
          >
            {label.noun}
          </span>
      )) : null}
      {status ? <span className="reel-status" style={{ bottom: mediaBottom }}>{status}</span> : null}
      {showRecorded ? <span className="reel-status" style={{ bottom: mediaBottom }}>{RECORDED_SAM_LABEL}</span> : null}
      {!status && !showRecorded && sampleChip ? (
        <span className="reel-status" style={labelMode === "tags" ? { top: 10, bottom: "auto", height: "auto", width: "max-content", alignSelf: "start" } : { bottom: mediaBottom }}>Sample</span>
      ) : null}
      {durationLabel ? <span className="reel-status is-duration">{durationLabel}</span> : null}
      {showProgress && playLoop ? (
        <div className="reel-progress" style={{ bottom: Math.max(0, mediaBottom - 28) }}>
          <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          <em>{clock}</em>
        </div>
      ) : null}
    </div>
  );
}

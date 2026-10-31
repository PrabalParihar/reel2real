"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { readableChipColor } from "@/src/ui/chip-color";
import { chooseLabelPosition, LABEL_CLEARANCE, type LabelRect } from "@/src/ui/label-place";
import { clipPathToRect, coverTransform, framePathFromPayload, frameToView, visibleFrameRect, type CoverTransform, type FrameBox, type MaskDraw, type ObjectPosition, type Point } from "@/src/samples/mask-geometry";
import {
  RECORDED_SAM_LABEL,
  SAM_FRAME,
  selectMaskRecord,
  type SamStepFile,
  type SceneNoun,
} from "@/src/samples/scene";

export interface OverlayRequest {
  samUrl: string;
  nouns: SceneNoun[];
}

interface DrawItem {
  noun: string;
  color: string;
  draw: MaskDraw;
  frameW: number;
  frameH: number;
  box: FrameBox;
}

function boxFullyInside(box: FrameBox, view: FrameBox): boolean {
  return box.x1 >= view.x1 - 0.5 && box.y1 >= view.y1 - 0.5 && box.x2 <= view.x2 + 0.5 && box.y2 <= view.y2 + 0.5;
}

function outlineSegments(d: string, frameW: number, frameH: number, cover: CoverTransform): Array<[Point, Point]> {
  const tokens = d.match(/[MLZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const segments: Array<[Point, Point]> = [];
  let cursor: Point | null = null;
  let start: Point | null = null;
  const at = (x: number, y: number) => frameToView(x, y, frameW, frameH, cover);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index].toUpperCase();
    if (token === "M" || token === "L") {
      const x = Number(tokens[index + 1]);
      const y = Number(tokens[index + 2]);
      index += 2;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const next = at(x, y);
      if (token === "M") {
        cursor = next;
        start = next;
      } else if (cursor) {
        segments.push([cursor, next]);
        cursor = next;
      }
    } else if (token === "Z" && cursor && start) {
      segments.push([cursor, start]);
      cursor = start;
    }
  }
  return segments;
}

/** Outer painted contour. The 4.5 core sits inside this glow stroke. */
const OUTLINE_STROKE = 14;

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
): Array<{ noun: string; color: string; x: number; y: number }> {
  const labels: Array<{ noun: string; color: string; x: number; y: number }> = [];
  const blocked: LabelRect[] = status ? [status] : [];
  const strokes = items.flatMap((item) => outlineSegments(item.draw.d, frameW, frameH, cover));
  const strokeScale = Math.max(cover.width / frameW, cover.height / frameH);
  const strokeRadius = (OUTLINE_STROKE / 2) * strokeScale;
  for (const item of items) {
    const outline = outlineSegments(item.draw.d, frameW, frameH, cover);
    if (!outline.length) continue;
    const bounds = outline.reduce((acc, [start, end]) => ({
      minX: Math.min(acc.minX, start.x, end.x),
      minY: Math.min(acc.minY, start.y, end.y),
      maxX: Math.max(acc.maxX, start.x, end.x),
      maxY: Math.max(acc.maxY, start.y, end.y),
    }), { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY });
    // Matches the 12px mono chip: 7.2px a glyph, 10px padding, 1px border.
    const labelW = item.noun.length * 7.2 + 22;
    const labelH = 27;
    const chosen = chooseLabelPosition({
      viewW: view.w,
      viewH: view.h,
      labelW,
      labelH,
      bounds,
      strokes,
      strokeRadius,
      clearance: LABEL_CLEARANCE,
      blocked,
    });
    if (!chosen) continue;
    blocked.push({
      x1: chosen.x - labelW / 2,
      y1: chosen.y - labelH / 2,
      x2: chosen.x + labelW / 2,
      y2: chosen.y + labelH / 2,
    });
    labels.push({ noun: item.noun, color: readableChipColor(item.color), x: chosen.x, y: chosen.y });
  }
  return labels;
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

export function PhotoFrame({
  src,
  alt,
  sizes = "(max-width: 800px) 100vw, 640px",
  overlay,
  recordedLabel = false,
  sampleChip = false,
  priority = false,
  className = "",
  loopSrc,
  objectPosition = { x: 0.5, y: 0.5 },
  zoom = 1,
  status,
  showProgress = false,
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
            const draw = framePathFromPayload(selected.mask, selected.box);
            if (!draw.d) continue;
            next.push({
              noun: noun.noun,
              color: noun.color || "#2dd4bf",
              draw,
              frameW: selected.box.frameW || SAM_FRAME.width,
              frameH: selected.box.frameH || SAM_FRAME.height,
              box: selected.box,
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

  const frameW = items[0]?.frameW || SAM_FRAME.width;
  const frameH = items[0]?.frameH || SAM_FRAME.height;
  const cover: CoverTransform | null = view.w > 0 && view.h > 0
    ? coverTransform(frameW, frameH, view.w, view.h, objectPosition, zoom)
    : null;
  const showRecorded = recordedLabel && !status;
  const statusText = status ? status : showRecorded ? RECORDED_SAM_LABEL : sampleChip ? "Sample" : null;
  const playLoop = Boolean(loopSrc) && !reduced;
  const gapBelow = cover ? view.h - (cover.top + cover.height) : 0;
  const mediaBottom = gapBelow > 8 ? gapBelow + 14 : 16;
  const visible = cover ? visibleFrameRect(frameW, frameH, view.w, view.h, cover) : null;
  const clipRect = visible
    ? {
        x1: visible.x1 + 6,
        y1: visible.y1 + 6,
        x2: visible.x2 - 6,
        y2: visible.y2 - 6,
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
            style={{ objectFit: "cover", maxWidth: "none" }}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              if (!video.duration) return;
              setRatio(video.currentTime / video.duration);
              setClock(formatClock(video.currentTime));
            }}
          />
        ) : (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            loading={priority ? undefined : "eager"}
            unoptimized
            style={{ objectFit: "cover", maxWidth: "none" }}
          />
        )}
        {items.length ? (
          <svg className="mask-svg" viewBox={`0 0 ${frameW} ${frameH}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            {items.map((item) => {
              if (!drawOutlines || (visible && !boxFullyInside(item.box, visible))) return null;
              const d = clipRect ? clipPathToRect(item.draw.d, clipRect) : item.draw.d;
              if (!d) return null;
              return (
                <g key={item.noun} data-noun={item.noun}>
                  <path d={d} fill={item.color} fillOpacity={0.2} stroke="none" />
                  <path d={d} fill="none" stroke={item.color} strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" strokeOpacity={0.55} filter={`url(#${glowId})`} />
                  <path d={d} fill="none" stroke={item.color} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>
      {labelMode === "tags" ? (
        <div className="noun-tags">
          {(overlay?.nouns ?? []).filter((noun) => noun.present).map((noun) => (
            <span key={noun.noun} className="noun-chip" style={{ borderColor: readableChipColor(noun.color), color: readableChipColor(noun.color) }}>{noun.noun}</span>
          ))}
        </div>
      ) : cover ? placeLabels(items, frameW, frameH, cover, view, statusText ? statusRect(statusText, view.w, view.h, mediaBottom) : null).map((label) => (
          <span
            key={label.noun}
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
      {showProgress && playLoop ? (
        <div className="reel-progress" style={{ bottom: Math.max(0, mediaBottom - 28) }}>
          <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          <em>{clock}</em>
        </div>
      ) : null}
    </div>
  );
}

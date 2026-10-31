"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { coverTransform, framePathFromPayload, frameToView, type CoverTransform, type MaskDraw, type ObjectPosition } from "@/src/samples/mask-geometry";
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
  const playLoop = Boolean(loopSrc) && !reduced;
  const mediaBottom = cover ? Math.max(16, view.h - (cover.top + cover.height) + 36) : 28;

  return (
    <div className={`photo-frame${className ? ` ${className}` : ""}`} ref={setHost}>
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
            style={{ objectFit: "fill" }}
          />
        )}
        {items.length ? (
          <svg className="mask-svg" viewBox={`0 0 ${frameW} ${frameH}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            {items.map((item) => (
              <g key={item.noun}>
                <path d={item.draw.d} fill={item.color} fillOpacity={0.2} stroke="none" />
                <path d={item.draw.d} fill="none" stroke={item.color} strokeWidth={14} strokeOpacity={0.55} filter={`url(#${glowId})`} />
                <path d={item.draw.d} fill="none" stroke={item.color} strokeWidth={4.5} />
              </g>
            ))}
          </svg>
        ) : null}
      </div>
      {cover ? items.map((item) => {
        if (!item.draw.centroid) return null;
        const point = frameToView(item.draw.centroid.x, item.draw.centroid.y, frameW, frameH, cover);
        return (
          <span
            key={item.noun}
            className="noun-chip"
            style={{
              left: Math.min(view.w - 36, Math.max(36, point.x)),
              top: Math.min(view.h - 40, Math.max(28, point.y)),
              borderColor: item.color,
              color: item.color,
            }}
          >
            {item.noun}
          </span>
        );
      }) : null}
      {status ? <span className="reel-status" style={{ bottom: mediaBottom }}>{status}</span> : null}
      {showRecorded ? <span className="reel-status" style={{ bottom: mediaBottom }}>{RECORDED_SAM_LABEL}</span> : null}
      {!status && !showRecorded && sampleChip ? <span className="reel-status" style={{ bottom: mediaBottom }}>Sample</span> : null}
      {showProgress && playLoop ? (
        <div className="reel-progress" style={{ bottom: Math.max(0, mediaBottom - 28) }}>
          <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          <em>{clock}</em>
        </div>
      ) : null}
    </div>
  );
}

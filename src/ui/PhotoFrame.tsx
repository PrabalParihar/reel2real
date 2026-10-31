"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { coverTransform, framePathFromPayload, type CoverTransform, type MaskDraw } from "@/src/samples/mask-geometry";
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

export function PhotoFrame({
  src,
  alt,
  sizes = "(max-width: 800px) 100vw, 640px",
  overlay,
  recordedLabel = false,
  sampleChip = false,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  sizes?: string;
  overlay?: OverlayRequest | null;
  recordedLabel?: boolean;
  sampleChip?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const glowId = useId().replace(/:/g, "");
  const [view, setView] = useState({ w: 0, h: 0 });
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [items, setItems] = useState<DrawItem[]>([]);
  const nounKey = (overlay?.nouns ?? []).map((noun) => `${noun.objectId}:${noun.requestId ?? ""}:${noun.present ? 1 : 0}`).join("|");
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

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
    ? coverTransform(frameW, frameH, view.w, view.h)
    : null;
  const showRecorded = recordedLabel && items.length > 0;

  return (
    <div className={`photo-frame${className ? ` ${className}` : ""}`} ref={setHost}>
      <div
        className="photo-cover"
        style={cover
          ? { left: cover.left, top: cover.top, width: cover.width, height: cover.height }
          : undefined}
      >
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} style={{ objectFit: "fill" }} />
        {items.length ? (
          <svg className="mask-svg" viewBox={`0 0 ${frameW} ${frameH}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" />
              </filter>
            </defs>
            {items.map((item) => (
              <g key={item.noun}>
                <path d={item.draw.d} fill={item.color} fillOpacity={0.28} stroke="none" />
                <path d={item.draw.d} fill="none" stroke={item.color} strokeWidth={7} strokeOpacity={0.45} filter={`url(#${glowId})`} />
                <path d={item.draw.d} fill="none" stroke={item.color} strokeWidth={2} />
              </g>
            ))}
          </svg>
        ) : null}
        {items.map((item) => item.draw.centroid ? (
          <span
            key={item.noun}
            className="noun-chip"
            style={{
              left: `${Math.min(86, Math.max(14, (item.draw.centroid.x / frameW) * 100))}%`,
              top: `${Math.min(82, Math.max(18, (item.draw.centroid.y / frameH) * 100))}%`,
              borderColor: item.color,
              color: item.color,
            }}
          >
            {item.noun}
          </span>
        ) : null)}
      </div>
      {showRecorded ? <span className="chip recorded-label">{RECORDED_SAM_LABEL}</span> : null}
      {!showRecorded && sampleChip ? <span className="chip recorded-label">Sample</span> : null}
    </div>
  );
}

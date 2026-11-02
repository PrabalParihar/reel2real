"use client";
import { useEffect, useRef, useState } from "react";
import { prepareStepPlayback } from "./source-playback";
export function StepSourceVideo({ src, startSec, endSec }: { src: string; startSec: number; endSec: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackRef = useRef<ReturnType<typeof prepareStepPlayback> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!videoRef.current) return;
    const playback = prepareStepPlayback(videoRef.current, { startSec, endSec });
    playbackRef.current = playback;
    setFailed(false);
    return () => { playback.dispose(); playbackRef.current = null; };
  }, [src, startSec, endSec]);
  return <>
    <p className="mono">Source demonstration · {startSec}s to {endSec}s</p>
    <video ref={videoRef} src={src} controls muted playsInline preload="metadata" aria-label="Source demonstration" onError={() => setFailed(true)} />
    <button type="button" className="btn btn-ghost btn-sm" onClick={async () => setFailed(!await playbackRef.current?.replay())}>Replay this step</button>
    {failed ? <p className="quiet" role="status">This source range could not play. Try the video controls, or choose the source file again.</p> : null}
  </>;
}

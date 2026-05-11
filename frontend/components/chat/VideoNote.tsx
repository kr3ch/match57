"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  src: string;
};

/**
 * Telegram-style round video note. 220×220 (sm:240×240) circle, no
 * native controls, tap to play/pause, ring progress arc on top.
 */
export function VideoNote({ src }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [t, setT] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => setT(el.currentTime);
    const onLoad = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setTotal(el.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setT(0);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoad);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoad);
      el.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.muted = false;
      setMuted(false);
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  const progress = total > 0 ? Math.min(1, t / total) : 0;
  // SVG ring: circumference = 2π * r ; r = 49 → C ≈ 308
  const R = 49;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - progress);

  return (
    <div className="relative h-[220px] w-[220px] sm:h-[240px] sm:w-[240px]">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Пауза" : "Воспроизвести"}
        className="group absolute inset-0 overflow-hidden rounded-full shadow-card outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-ember-400"
      >
        <video
          ref={videoRef}
          src={src}
          muted={muted}
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        {!playing && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink-950/30 transition group-hover:bg-ink-950/20">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-ink-950 shadow-card backdrop-blur">
              <svg viewBox="0 0 16 16" className="h-5 w-5 translate-x-[1.5px]" fill="currentColor">
                <path d="M3.5 2.2v11.6c0 .8.9 1.2 1.5.8l8.5-5.8c.6-.4.6-1.3 0-1.7L5 1.4c-.6-.4-1.5 0-1.5.8z" />
              </svg>
            </span>
          </span>
        )}
      </button>

      <svg
        viewBox="0 0 100 100"
        className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.5"
        />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 100ms linear" }}
        />
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink-950/70 px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-white backdrop-blur">
        {fmt(playing ? Math.max(0, total - t) : total)}
      </div>
    </div>
  );
}

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

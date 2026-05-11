"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  src: string;
  durationMs?: number | null;
  isMine: boolean;
};

/**
 * Telegram-style voice message: circular play button + faux-waveform
 * progress bar + mm:ss timer. Real audio waveform analysis requires
 * decoding the buffer (expensive); we render a deterministic pseudo
 * waveform seeded by the src URL so the same message always looks the
 * same, which is enough for the UX intent.
 */
export function VoicePlayer({ src, durationMs, isMine }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [total, setTotal] = useState((durationMs ?? 0) / 1000);

  const bars = useBars(src);

  useEffect(() => {
    const el = audioRef.current;
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
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  const progress = total > 0 ? Math.min(1, t / total) : 0;

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = pct * total;
    setT(el.currentTime);
  };

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Пауза" : "Воспроизвести"}
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-full transition active:scale-95 ${
          isMine
            ? "bg-ink-950/20 text-ink-950 hover:bg-ink-950/30"
            : "bg-ember-500 text-ink-950 hover:brightness-110"
        }`}
      >
        {playing ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
            <rect x="3" y="2.5" width="3.5" height="11" rx="1" />
            <rect x="9.5" y="2.5" width="3.5" height="11" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-4 w-4 translate-x-[1px]" fill="currentColor">
            <path d="M3.5 2.2v11.6c0 .8.9 1.2 1.5.8l8.5-5.8c.6-.4.6-1.3 0-1.7L5 1.4c-.6-.4-1.5 0-1.5.8z" />
          </svg>
        )}
      </button>

      <div
        className="flex h-8 min-w-[140px] cursor-pointer items-center gap-[2px] sm:min-w-[180px]"
        onClick={onSeek}
        role="slider"
        aria-valuenow={Math.round(progress * 100)}
      >
        {bars.map((h, i) => {
          const played = i / bars.length < progress;
          return (
            <span
              key={i}
              className={`w-[3px] rounded-full transition-colors ${
                played
                  ? isMine
                    ? "bg-ink-950"
                    : "bg-ember-300"
                  : isMine
                  ? "bg-ink-950/30"
                  : "bg-white/30"
              }`}
              style={{ height: `${h * 100}%` }}
            />
          );
        })}
      </div>

      <span
        className={`min-w-[34px] text-right text-[11px] tabular-nums ${
          isMine ? "text-ink-950/70" : "text-ink-200/70"
        }`}
      >
        {fmt(playing || t > 0 ? Math.max(0, total - t) : total)}
      </span>
    </div>
  );
}

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const BAR_COUNT = 28;

function useBars(seed: string): number[] {
  return useMemo(() => {
    // Deterministic hash so the same message always renders the same
    // waveform between client renders / SSR hydration.
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const out: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      const v = ((h >>> 0) % 1000) / 1000;
      out.push(0.25 + v * 0.7);
    }
    return out;
  }, [seed]);
}

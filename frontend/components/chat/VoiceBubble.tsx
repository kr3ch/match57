"use client";

import { useEffect, useRef, useState } from "react";

import { VolumeControl } from "./VolumeControl";

function format(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Messenger-style voice bubble — single play/pause control, a scrubbable
 * progress bar with an inline waveform feel, and a duration / position
 * read-out. Hides the browser's default ``<audio controls>`` chrome.
 *
 * ``durationMs`` is honoured as a hint when the audio element hasn't
 * loaded metadata yet so the bubble doesn't render as "0:00" before
 * playback starts.
 */
export function VoiceBubble({
  src,
  isMine,
  durationMs,
}: {
  src: string;
  isMine: boolean;
  durationMs?: number | null;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [duration, setDuration] = useState<number>(() =>
    durationMs && durationMs > 0 ? durationMs / 1000 : 0,
  );

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setPos(a.currentTime);
    const onMeta = () => {
      if (Number.isFinite(a.duration)) setDuration(a.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setPos(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = ref.current;
    const v = Number(e.target.value);
    setPos(v);
    if (a && Number.isFinite(a.duration)) a.currentTime = v;
  }

  const pct = duration > 0 ? (pos / duration) * 100 : 0;
  const accent = isMine ? "rgb(10 8 5)" : "rgb(255 111 60)";
  const track = isMine ? "rgba(10,8,5,0.25)" : "rgba(255,255,255,0.18)";

  return (
    <div
      className="flex items-center gap-3 min-w-[200px]"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={playing ? "Пауза" : "Воспроизвести"}
        onClick={toggle}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
          isMine
            ? "bg-ink-950/85 text-ember-100"
            : "bg-ember-500 text-ink-950 shadow-card"
        }`}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.0001)}
          step={0.01}
          value={pos}
          onChange={seek}
          aria-label="Позиция воспроизведения"
          className="voice-range h-1 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, ${accent} 0%, ${accent} ${pct}%, ${track} ${pct}%, ${track} 100%)`,
          }}
        />
        <div
          className={`flex items-center justify-between text-[10px] tabular-nums ${
            isMine ? "text-ink-950/70" : "text-ink-200/70"
          }`}
        >
          <span>{format(pos)}</span>
          <span>{format(duration)}</span>
        </div>
      </div>

      <VolumeControl
        mediaRef={ref}
        variant={isMine ? "voice-mine" : "voice-other"}
      />

      <audio ref={ref} src={src} preload="metadata" className="hidden" />
    </div>
  );
}

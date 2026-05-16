"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Chat video bubble with a fully custom overlay — we never render the
 * browser's default controls (which look out of place on iOS / Chrome).
 *
 * Layout while paused: large play button in the centre + faint duration
 * badge bottom-right.
 *
 * Layout while playing: subtle bottom bar with play/pause, time, slim
 * progress and a fullscreen toggle. The bar fades out after ~2s of
 * inactivity and re-appears on hover / tap.
 */
type Props = {
  src: string;
  isMine: boolean;
};

function fmt(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoBubble({ src, isMine }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 2000);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (!playing) return; // keep visible when paused
    scheduleHide();
  }, [playing, scheduleHide]);

  // Reset the timer whenever play state flips.
  useEffect(() => {
    if (playing) {
      scheduleHide();
    } else {
      setControlsVisible(true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    }
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [playing, scheduleHide]);

  // Track fullscreen toggles so the icon switches state.
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const ratio = Number(e.target.value) / 1000;
    v.currentTime = ratio * (duration || 0);
    revealControls();
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* iOS Safari rejects requestFullscreen on non-video elements; we just
       * swallow this and fall back to the inline player. */
    }
  };

  const progress = duration > 0 ? (current / duration) * 1000 : 0;

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-2xl shadow-card ring-1 ring-white/10 ${
        isMine ? "bg-black/30" : "bg-black/40"
      }`}
      style={{ maxWidth: isFullscreen ? "100vw" : "min(320px, 70vw)" }}
      onMouseEnter={revealControls}
      onMouseMove={revealControls}
      onTouchStart={(e) => {
        e.stopPropagation();
        revealControls();
      }}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        onClick={(e) => {
          e.stopPropagation();
          if (!playing) {
            togglePlay();
          } else {
            // Tapping the body while playing toggles the bar instead of pausing
            // — common UX in messengers (Tg, WhatsApp).
            setControlsVisible((v) => !v);
            if (!controlsVisible) scheduleHide();
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          setDuration((e.target as HTMLVideoElement).duration || 0);
          setReady(true);
        }}
        onTimeUpdate={(e) => {
          setCurrent((e.target as HTMLVideoElement).currentTime || 0);
        }}
        className="block h-auto w-full max-h-80 rounded-2xl object-cover"
      />

      {/* Centre play button — only while paused. */}
      {!playing && (
        <button
          type="button"
          aria-label="Воспроизвести видео"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/55 via-black/15 to-transparent transition hover:from-black/65"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ember-500/95 text-ink-950 shadow-[0_8px_30px_rgba(244,134,90,0.55)] ring-1 ring-ember-50/30 transition active:scale-95">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="ml-0.5">
              <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
            </svg>
          </span>
          {!ready && (
            <span className="absolute bottom-2 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur">
              загрузка…
            </span>
          )}
          {ready && duration > 0 && (
            <span className="absolute bottom-2 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] tabular-nums text-white/90 backdrop-blur">
              {fmt(duration)}
            </span>
          )}
        </button>
      )}

      {/* Bottom control bar — visible while playing (auto-hides) or while
       * the user is hovering with controlsVisible=true. */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/65 via-black/35 to-transparent px-3 pb-2 pt-6 transition-opacity duration-200 ${
          playing && controlsVisible ? "opacity-100" : playing ? "opacity-0" : "opacity-0"
        }`}
      >
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={progress}
          onChange={seek}
          onClick={(e) => e.stopPropagation()}
          aria-label="Перемотка"
          className="voice-range pointer-events-auto h-1 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, rgb(255 111 60) 0%, rgb(255 111 60) ${
              progress / 10
            }%, rgba(255,255,255,0.25) ${progress / 10}%, rgba(255,255,255,0.25) 100%)`,
            color: "rgb(255 111 60)",
          }}
        />
        <div className="pointer-events-auto flex items-center justify-between text-[11px] tabular-nums text-white/85">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              aria-label={playing ? "Пауза" : "Играть"}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25 active:scale-95"
            >
              {playing ? (
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="ml-0.5">
                  <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
                </svg>
              )}
            </button>
            <span>{fmt(current)} / {fmt(duration)}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleFullscreen();
            }}
            aria-label={isFullscreen ? "Свернуть" : "Во весь экран"}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25 active:scale-95"
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path
                  d="M9 9H4v2h7V4H9v5zm6 6h5v-2h-7v7h2v-5zM9 15v5h2v-7H4v2h5zm6-6V4h-2v7h7V9h-5z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path
                  d="M4 8V4h4v2H6v2H4zm12-4h4v4h-2V6h-2V4zM4 16h2v2h2v2H4v-4zm14 0h2v4h-4v-2h2v-2z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

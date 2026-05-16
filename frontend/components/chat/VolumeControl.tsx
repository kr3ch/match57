"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Telegram/YouTube-style volume widget shared by VideoBubble and
 * VoiceBubble. Renders a small mute / unmute button; on hover the
 * horizontal slider expands to its left so the right edge of the
 * controls bar stays anchored.
 *
 * Volume and muted state are persisted to localStorage so they carry
 * across messages, conversations and tabs.
 */

const VOLUME_KEY = "m57:player:volume";
const MUTED_KEY = "m57:player:muted";

function readVolume(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(VOLUME_KEY);
  const v = raw == null ? NaN : Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1;
}

function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTED_KEY) === "1";
}

type Variant = "video" | "voice-mine" | "voice-other";

export function VolumeControl({
  mediaRef,
  variant,
  onInteract,
}: {
  mediaRef: React.RefObject<HTMLMediaElement>;
  variant: Variant;
  onInteract?: () => void;
}) {
  const [volume, setVolume] = useState<number>(() => readVolume());
  const [muted, setMuted] = useState<boolean>(() => readMuted());
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  // Sync state -> media element + localStorage.
  useEffect(() => {
    const m = mediaRef.current;
    if (m) {
      m.volume = volume;
      m.muted = muted || volume === 0;
    }
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume));
      window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    } catch {
      /* private-mode storage may throw; harmless. */
    }
  }, [mediaRef, volume, muted]);

  // Re-apply to a freshly-mounted media element (e.g. when the bubble
  // mounts after the parent rendered).
  useEffect(() => {
    const m = mediaRef.current;
    if (m) {
      m.volume = volume;
      m.muted = muted || volume === 0;
    }
    // We intentionally run this only once per mount; later updates flow
    // through the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function show() {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
    onInteract?.();
  }
  function scheduleHide() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 350);
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    setMuted((prev) => {
      const next = !prev;
      // Bumping a fully-zero volume to something audible on unmute
      // matches what YouTube does — otherwise unmute does nothing.
      if (!next && volume === 0) setVolume(0.6);
      return next;
    });
    onInteract?.();
  }

  function onSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setVolume(v);
    if (muted && v > 0) setMuted(false);
    onInteract?.();
  }

  const effective = muted ? 0 : volume;
  const pct = Math.round(effective * 100);

  // Color theming: video uses white-on-black; voice uses the bubble color.
  const slider =
    variant === "voice-mine"
      ? { thumb: "rgb(10 8 5)", track: "rgba(10,8,5,0.25)" }
      : { thumb: "rgb(255 148 104)", track: "rgba(255,255,255,0.25)" };

  const btnClass =
    variant === "voice-mine"
      ? "text-ink-950/80 hover:text-ink-950"
      : "text-white/85 hover:text-white";

  return (
    <div
      className="pointer-events-auto relative flex items-center"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      {/* Slider rail — grows from 0 to ~80px on hover. Stays inside the
       * controls bar's footprint, never expands the parent. */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          open ? "mr-1 w-20 opacity-100" : "w-0 opacity-0"
        }`}
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={effective}
          onChange={onSlider}
          onClick={(e) => e.stopPropagation()}
          aria-label="Громкость"
          className="m57-volume h-1 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, ${slider.thumb} 0%, ${slider.thumb} ${pct}%, ${slider.track} ${pct}%, ${slider.track} 100%)`,
          }}
        />
      </div>

      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted || volume === 0 ? "Включить звук" : "Выключить звук"}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/15 active:scale-95 ${btnClass}`}
      >
        {muted || effective === 0 ? (
          // muted
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              d="M4 9v6h4l5 4V5L8 9H4z M16.5 12l3-3-1.4-1.4-3 3-3-3L10.7 9l3 3-3 3 1.4 1.4 3-3 3 3 1.4-1.4-3-3z"
              fill="currentColor"
            />
          </svg>
        ) : effective < 0.5 ? (
          // low volume
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
            <path
              d="M15.5 8.5a4.5 4.5 0 010 7"
              stroke="currentColor"
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          // high volume
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
            <path
              d="M15.5 8.5a4.5 4.5 0 010 7 M17.7 6a8 8 0 010 12"
              stroke="currentColor"
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

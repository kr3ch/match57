"use client";

import { useRef, useState } from "react";

/**
 * Chat video bubble — replaces the browser default ``<video controls>`` UI
 * with a rounded card, drop shadow and a single overlay play button. The
 * native controls only appear once the user starts playback so the closed
 * state stays clean and on-brand.
 */
export function VideoBubble({ src, isMine }: { src: string; isMine: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-card ring-1 ring-white/10 ${
        isMine ? "bg-black/30" : "bg-black/40"
      }`}
      style={{ maxWidth: "min(320px, 70vw)" }}
    >
      <video
        ref={ref}
        src={src}
        playsInline
        preload="metadata"
        controls={playing}
        onClick={(e) => {
          // Prevent the parent bubble from toggling its action menu when
          // the user just wants to play/pause.
          e.stopPropagation();
          if (!playing) toggle();
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedData={() => setReady(true)}
        className="block h-auto w-full max-h-80 rounded-2xl object-cover"
      />

      {!playing && (
        <button
          type="button"
          aria-label="Воспроизвести видео"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/55 via-black/15 to-transparent transition hover:from-black/65"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ember-500/95 text-ink-950 shadow-[0_8px_30px_rgba(244,134,90,0.55)] ring-1 ring-ember-50/30 transition active:scale-95">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              aria-hidden="true"
              className="ml-0.5"
            >
              <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
            </svg>
          </span>
          {!ready && (
            <span className="absolute bottom-2 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur">
              загрузка…
            </span>
          )}
        </button>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Fullscreen photo viewer. Mounted on demand by the chat bubble when a
 * user taps the image. Lives outside the bubble so it can take the
 * whole viewport without fighting the bubble's max-width / flex flow.
 *
 * Close on:
 *  - clicking the backdrop
 *  - clicking the × button
 *  - pressing Escape
 *
 * Zoom: click / tap on the image toggles between fit-to-screen
 * (object-contain) and 1× pixel scale so very long photos can be
 * inspected without leaving the chat.
 */
export function PhotoLightbox({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll so the lightbox doesn't double-scroll on mobile.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-auto bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onClick={(e) => {
          e.stopPropagation();
          setZoomed((v) => !v);
        }}
        className={
          zoomed
            ? "max-w-none cursor-zoom-out"
            : "max-h-[95vh] max-w-[95vw] cursor-zoom-in object-contain"
        }
        style={zoomed ? { width: "auto", height: "auto" } : undefined}
      />
    </div>
  );
}

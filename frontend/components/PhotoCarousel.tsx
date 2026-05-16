"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { Photo } from "@/lib/types";
import { mediaUrl } from "@/lib/media";

export function PhotoCarousel({
  photos,
  className,
  rounded = "rounded-3xl",
  /** Force the carousel to fill its parent’s box (parent must already
   * have a definite size and `position: relative`). Used on the public
   * profile page where we want the photo + info overlay to fit in one
   * viewport without scrolling. */
  fill = false,
  /** Hint that this carousel is above the fold and worth eagerly
   * fetching. Adds `fetchpriority="high"` + eager loading to the first
   * frame so the hero image paints faster on slow networks. */
  priority = false,
}: {
  photos: Photo[];
  className?: string;
  rounded?: string;
  fill?: boolean;
  priority?: boolean;
}) {
  const [i, setI] = useState(0);
  // In fill mode the wrapper is positioned absolutely to fully occupy
  // its parent’s box (the parent must be `position: relative` and have
  // a definite size). Otherwise it locks to a 3:4 portrait box.
  //
  // Note: do NOT mix `relative` + `absolute` on the same element — in
  // Tailwind’s default utility order `.relative` wins and `inset-0` is
  // ignored, which on a flex parent with only min-height can collapse
  // the image to zero height (regression seen in PR #34).
  const positioning = fill
    ? "absolute inset-0"
    : "relative aspect-[3/4] w-full";
  if (!photos || photos.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${positioning} ${rounded} bg-ink-700/40 text-ink-200/60 ${className ?? ""}`}
      >
        нет фото
      </div>
    );
  }
  const photo = photos[Math.min(i, photos.length - 1)];
  const url = mediaUrl(photo.user_id, photo.filename);

  return (
    <div
      className={`group overflow-hidden ${positioning} ${rounded} bg-ink-900 ${className ?? ""}`}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={photo.id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          {photo.kind === "video" ? (
            <video
              src={url}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload={priority ? "auto" : "metadata"}
            />
          ) : (
            // Plain <img>. Intentionally no width/height HTML attrs:
            // the carousel sizes itself via CSS (h-full / aspect-ratio)
            // and explicit intrinsic dimensions can fight responsive
            // layouts in some flex/grid edge cases.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : "auto"}
              className="h-full w-full select-none object-cover"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Предыдущее фото"
            onClick={(e) => {
              e.stopPropagation();
              setI((p) => (p - 1 + photos.length) % photos.length);
            }}
            className="absolute inset-y-0 left-0 w-1/3"
          />
          <button
            type="button"
            aria-label="Следующее фото"
            onClick={(e) => {
              e.stopPropagation();
              setI((p) => (p + 1) % photos.length);
            }}
            className="absolute inset-y-0 right-0 w-1/3"
          />
          <div className="pointer-events-none absolute left-2 right-2 top-2 flex gap-1.5">
            {photos.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 flex-1 rounded-full transition ${
                  idx === i ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
    </div>
  );
}

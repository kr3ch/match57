"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/media";
import { motion, AnimatePresence } from "framer-motion";

type Photo = { type: "photo" | "video"; file_id: string };

export function PhotoCarousel({
  photos,
  className,
  rounded = "rounded-3xl",
}: {
  photos: Photo[];
  className?: string;
  rounded?: string;
}) {
  const [i, setI] = useState(0);
  if (!photos || photos.length === 0) {
    return (
      <div
        className={`flex aspect-[3/4] items-center justify-center ${rounded} bg-ink-700/40 text-ink-200/60 ${className ?? ""}`}
      >
        нет фото
      </div>
    );
  }
  const photo = photos[Math.min(i, photos.length - 1)];

  return (
    <div className={`group relative aspect-[3/4] w-full overflow-hidden ${rounded} bg-ink-900 ${className ?? ""}`}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={photo.file_id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          {photo.type === "video" ? (
            <video
              src={mediaUrl(photo.file_id)}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(photo.file_id)}
              alt=""
              draggable={false}
              className="h-full w-full select-none object-cover"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* tap-zones */}
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
          {/* segment bars */}
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
      {/* readability gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
    </div>
  );
}

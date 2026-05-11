"use client";

import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";
import type { PublicProfile } from "@/lib/types";
import { PhotoCarousel } from "./PhotoCarousel";

type Decision = "like" | "dislike" | "report" | "message";

export function SwipeCard({
  profile,
  caption,
  onDecision,
  onMessage,
  onReport,
  isTop,
  index,
}: {
  profile: PublicProfile;
  caption: string;
  onDecision: (d: Decision) => void;
  onMessage: () => void;
  onReport: () => void;
  isTop: boolean;
  index: number;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Subtle 3D tilt as the card moves -- per the 3d-web-experience SKILL we
  // only use 3D when it serves a purpose: here it gives weight to the swipe.
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
  const tiltY = useSpring(useTransform(x, [-300, 0, 300], [10, 0, -10]), {
    stiffness: 220,
    damping: 18,
  });
  const tiltX = useSpring(useTransform(y, [-300, 0, 300], [-8, 0, 8]), {
    stiffness: 220,
    damping: 18,
  });
  const likeOpacity = useTransform(x, [60, 200], [0, 1]);
  const nopeOpacity = useTransform(x, [-200, -60], [1, 0]);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTop) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onDecision("dislike");
      if (e.key === "ArrowRight") onDecision("like");
      if (e.key === "Enter") onMessage();
      if (e.key === "r" || e.key === "R") onReport();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isTop, onDecision, onMessage, onReport]);

  return (
    <motion.div
      ref={cardRef}
      className="absolute inset-0 will-change-transform"
      style={{
        x,
        y,
        rotate,
        rotateX: tiltX,
        rotateY: tiltY,
        zIndex: 100 - index,
      }}
      drag={isTop}
      dragElastic={0.6}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        const dx = info.offset.x;
        if (dx > 140) {
          onDecision("like");
        } else if (dx < -140) {
          onDecision("dislike");
        }
      }}
      animate={
        isTop
          ? { scale: 1, opacity: 1, y: 0 }
          : { scale: 1 - index * 0.04, y: index * 8, opacity: 1 - index * 0.18 }
      }
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <div className="glass relative h-full p-3 shadow-card">
        <PhotoCarousel photos={profile.photos} className="h-full" />
        {/* Like / Nope stamps */}
        <motion.div
          style={{ opacity: likeOpacity }}
          className="pointer-events-none absolute left-8 top-12 -rotate-12 rounded-2xl border-2 border-ember-300 bg-ember-500/30 px-4 py-1 text-2xl font-bold uppercase tracking-widest text-ember-100"
        >
          {profile.gender === "Девушка" ? "крутая" : "крутой"}
        </motion.div>
        <motion.div
          style={{ opacity: nopeOpacity }}
          className="pointer-events-none absolute right-8 top-12 rotate-12 rounded-2xl border-2 border-rose-300 bg-rose-500/30 px-4 py-1 text-2xl font-bold uppercase tracking-widest text-rose-100"
        >
          мимо
        </motion.div>
        {/* Caption */}
        <div className="absolute inset-x-5 bottom-6 text-white drop-shadow-lg">
          <div className="display text-3xl leading-tight sm:text-4xl">
            {profile.name}, {profile.age}
          </div>
          {profile.description ? (
            <p className="mt-2 line-clamp-3 text-sm text-white/85">
              {profile.description}
            </p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

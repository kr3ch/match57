"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { APIError, api } from "@/lib/api";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { AdminBadge } from "@/components/AdminBadge";
import type { PublicProfile } from "@/lib/types";

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const { push } = useNotifications();
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      router.replace("/chats");
      return;
    }
    api
      .viewUser(id)
      .then(({ profile: p }) => setProfile(p))
      .catch((e) => {
        if (e instanceof APIError) push({ title: "Не найдено", body: e.detail });
        router.back();
      });
  }, [id, push, router]);

  if (!profile) {
    return (
      <main className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-ink-200/60">Грузим…</p>
      </main>
    );
  }

  // The page is laid out as a 2-row CSS grid so the photo section gets a
  // *definite* height (`1fr`) regardless of flex-basis quirks. Total
  // height ties to the app layout: `(app)/layout.tsx` reserves `pt-4`
  // (1rem) on top and `pb-32` (8rem) on the bottom for the nav, so the
  // available content area is `100dvh - 9rem`. We use a slightly larger
  // 9.5rem cushion to leave a tiny breathing room above the nav.
  const pageHeight = "calc(100dvh - 9.5rem)";
  return (
    <main
      className="grid grid-rows-[auto_1fr] gap-3"
      style={{ height: pageHeight }}
    >
      <header className="flex items-center justify-between">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>
          ← назад
        </button>
        {profile.is_admin ? <AdminBadge size="sm" /> : null}
      </header>

      {/* The photo section is `relative` so the PhotoCarousel
       * (`absolute inset-0`) and the info overlay can stack on top of
       * it. It has its own width cap (max-w-md) to keep things sane on
       * wide screens. */}
      <section className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-ink-900 shadow-card">
        {profile.photos.length > 0 ? (
          <PhotoCarousel photos={profile.photos} fill priority />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-200/60">
            нет фото
          </div>
        )}

        {/* Info overlay sits on top of the carousel's own bottom-gradient.
         * pointer-events-none so swipe taps still reach the carousel
         * left/right zones underneath. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-5 pt-14 text-white">
          <div
            className="absolute inset-x-0 bottom-0 -z-10 h-full"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0) 100%)",
            }}
          />
          <div className="display flex flex-wrap items-baseline gap-2 text-3xl leading-tight sm:text-4xl">
            <span>
              {profile.name}, {profile.age}
            </span>
          </div>
          <div className="mt-1 text-sm text-white/80">
            {profile.gender} · ищет {profile.looking_for.toLowerCase()}
          </div>
          {profile.school ? (
            <div className="mt-0.5 text-xs text-white/70">школа {profile.school}</div>
          ) : null}
          {profile.description ? (
            <p className="mt-2 line-clamp-3 text-sm text-white/90">
              {profile.description}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

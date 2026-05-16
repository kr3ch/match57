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

  return (
    // The whole page is intentionally height-capped so that on a typical
    // phone (≈ 100dvh − app top padding − bottom nav) the photo + info
    // overlay fit in one viewport without scrolling. Long descriptions
    // are line-clamped; tap the description to expand inline.
    <main className="flex flex-col gap-3" style={{ minHeight: "calc(100dvh - 10rem)" }}>
      <header className="flex items-center justify-between">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>
          ← назад
        </button>
        {profile.is_admin ? <AdminBadge size="sm" /> : null}
      </header>

      <section className="relative mx-auto w-full max-w-md flex-1 min-h-0 overflow-hidden rounded-3xl bg-ink-900 shadow-card">
        {profile.photos.length > 0 ? (
          <PhotoCarousel photos={profile.photos} fill priority />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-200/40">
            нет фото
          </div>
        )}

        {/* Info overlay sits on top of the carousel's own bottom-gradient
         * (PhotoCarousel already paints a from-black/85 fade). Stacking
         * order here is: photo → carousel gradient → this overlay. */}
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

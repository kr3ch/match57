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

  if (!profile) return <p className="text-ink-200/60">Грузим…</p>;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-baseline justify-between">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>
          ← назад
        </button>
      </header>

      {profile.photos.length > 0 ? (
        <PhotoCarousel photos={profile.photos} />
      ) : (
        <div className="glass flex aspect-[3/4] items-center justify-center rounded-3xl text-ink-200/40">
          нет фото
        </div>
      )}

      <div className="glass p-5">
        <div className="flex items-center gap-2">
          <span className="display text-3xl">{profile.name}, {profile.age}</span>
          {profile.is_admin ? <AdminBadge size="sm" /> : null}
        </div>
        <div className="mt-1 text-sm text-ink-200/70">
          {profile.gender} · ищет {profile.looking_for.toLowerCase()}
        </div>
        {profile.school && (
          <div className="mt-1 text-xs text-ink-200/60">школа {profile.school}</div>
        )}
        {profile.description && (
          <p className="mt-3 text-ink-100/85">{profile.description}</p>
        )}
      </div>
    </main>
  );
}

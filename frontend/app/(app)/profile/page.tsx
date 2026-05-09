"use client";

import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";

import { api } from "@/lib/api";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { useAuth } from "@/components/providers/AuthProvider";

export default function ProfilePage() {
  const { data, isLoading } = useSWR("me/profile", () => api.myProfile());
  const { me } = useAuth();

  if (isLoading || !data) {
    return <p className="text-ink-200/60">Грузим…</p>;
  }
  const profile = data.profile;

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <span className="label">твой профиль</span>
          <h1 className="display text-4xl sm:text-5xl">
            {profile.name}, {profile.age}
          </h1>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-200/70">
            <span>{profile.gender}</span>
            <span>· ищет {profile.looking_for.toLowerCase()}</span>
            {profile.hidden ? (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-200">
                скрыт
              </span>
            ) : null}
            {me?.is_admin ? (
              <span className="rounded-full bg-gold-100/10 px-2 py-0.5 text-gold-200">
                админ
              </span>
            ) : null}
          </div>
        </div>
        <Link href="/profile/edit" className="btn-ghost">
          редактировать
        </Link>
      </header>

      <div className="mx-auto w-full max-w-md">
        <PhotoCarousel photos={profile.photos} />
      </div>

      {profile.description ? (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-soft px-5 py-5 text-base"
        >
          {profile.description}
        </motion.p>
      ) : null}

      <div className="glass-soft px-4 py-4 text-sm">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-200/70">
          email
        </div>
        <div className="mt-1">{profile.email}</div>
        {profile.email_verified ? (
          <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">
            подтверждён
          </span>
        ) : (
          <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">
            не подтверждён
          </span>
        )}
      </div>

      <Link href="/settings" className="btn-ghost justify-between">
        <span>настройки и приглашения</span>
        <span>→</span>
      </Link>
    </main>
  );
}

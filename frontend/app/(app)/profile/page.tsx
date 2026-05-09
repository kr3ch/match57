"use client";

import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { useAuth } from "@/components/providers/AuthProvider";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const { data, isLoading } = useSWR("me/profile", () => api.myProfile());
  const { me } = useAuth();

  if (isLoading || !data) {
    return <p className="text-ink-200/60">Грузим…</p>;
  }

  const stats = [
    { k: "лайков получено", v: data.likes_received?.length ?? 0 },
    { k: "лайков отправлено", v: data.likes_sent?.length ?? 0 },
    { k: "мэтчей", v: data.matches?.length ?? 0 },
    { k: "приглашено", v: data.referrals?.length ?? 0 },
  ];

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <span className="label">твой профиль</span>
          <h1 className="display text-4xl sm:text-5xl">
            {data.name}, {data.age}
          </h1>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-200/70">
            <span>{data.gender}</span>
            <span>· ищет {data.looking_for.toLowerCase()}</span>
            {data.hidden ? (
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
        <PhotoCarousel photos={data.photos} />
      </div>

      {data.description ? (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-soft px-5 py-5 text-base"
        >
          {data.description}
        </motion.p>
      ) : null}

      <ul className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <li key={s.k} className="glass-soft px-4 py-4">
            <div className="display text-3xl">{s.v}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-ink-200/70">
              {s.k}
            </div>
          </li>
        ))}
      </ul>

      <Link href="/settings" className="btn-ghost justify-between">
        <span>настройки и приглашения</span>
        <span>→</span>
      </Link>
    </main>
  );
}

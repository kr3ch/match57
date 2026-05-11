"use client";

import Link from "next/link";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";

const SECTIONS = [
  {
    href: "/admin/users",
    label: "Пользователи",
    desc: "Поиск, бан, удаление",
    icon: "👥",
  },
  {
    href: "/admin/reports",
    label: "Жалобы",
    desc: "Закрыть, забанить",
    icon: "🚩",
    accent: true,
  },
  {
    href: "/admin/broadcast",
    label: "Рассылка",
    desc: "Системное сообщение всем",
    icon: "📣",
  },
  {
    href: "/admin/leaderboards",
    label: "Топы",
    desc: "Лайки · мэтчи · рефералы",
    icon: "🏆",
  },
];

export default function AdminPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && me && !me.is_admin) router.replace("/swipe");
  }, [me, loading, router]);

  const { data: stats, isLoading } = useSWR(
    me?.is_admin ? "admin/stats" : null,
    () => api.adminStats(),
  );

  const openReports = stats?.open_reports ?? 0;

  return (
    <main className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-1">
        <span className="pill self-start">
          <span className="h-1.5 w-1.5 rounded-full bg-ember-400" />
          админ-панель
        </span>
        <h1 className="display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          MATCH 57
        </h1>
        <p className="text-sm text-ink-100/60">
          Модерация и метрики. Действия логируются.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="всего" value={stats?.total_users} loading={isLoading} />
        <Stat label="скрыто" value={stats?.hidden} loading={isLoading} />
        <Stat label="забанено" value={stats?.banned} loading={isLoading} />
        <Stat label="фото" value={stats?.photo_count} loading={isLoading} />
        <Stat label="лайков" value={stats?.total_likes} loading={isLoading} />
        <Stat label="дизлайков" value={stats?.total_dislikes} loading={isLoading} />
        <Stat label="мэтчей" value={stats?.total_matches} loading={isLoading} />
        <Stat
          label="жалоб открыто"
          value={openReports}
          warn={openReports > 0}
          loading={isLoading}
        />
      </section>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className={`glass group flex items-center gap-4 p-4 transition hover:bg-white/[0.08] active:scale-[0.99] sm:p-5 ${
                s.accent && openReports > 0
                  ? "ring-1 ring-rose-400/40"
                  : ""
              }`}
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white/5 text-xl">
                {s.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="display text-lg font-semibold tracking-tight sm:text-xl">
                  {s.label}
                  {s.accent && openReports > 0 ? (
                    <span className="ml-2 rounded-full bg-rose-500/25 px-2 py-0.5 align-middle text-[10px] font-medium text-rose-200">
                      {openReports}
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-ink-100/60 sm:text-sm">
                  {s.desc}
                </div>
              </div>
              <span className="text-lg text-ink-200/50 transition group-hover:translate-x-0.5 group-hover:text-ink-100">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Stat({
  label,
  value,
  warn,
  loading,
}: {
  label: string;
  value: number | string | undefined;
  warn?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={`glass-soft px-4 py-4 transition ${
        warn ? "border-rose-400/30 bg-rose-500/10" : ""
      }`}
    >
      {loading ? (
        <div className="h-7 w-12 animate-pulse rounded-md bg-white/10" />
      ) : (
        <div
          className={`display text-2xl font-semibold tracking-tight sm:text-3xl ${
            warn ? "text-rose-200" : ""
          }`}
        >
          {value ?? "—"}
        </div>
      )}
      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-200/60 sm:text-[11px]">
        {label}
      </div>
    </div>
  );
}

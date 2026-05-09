"use client";

import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const SECTIONS = [
  { href: "/admin/users", label: "Пользователи", desc: "Список с фильтрами" },
  { href: "/admin/search", label: "Поиск", desc: "По username, имени, ID" },
  { href: "/admin/reports", label: "Жалобы", desc: "Бан / удалить / закрыть" },
  { href: "/admin/broadcast", label: "Рассылка", desc: "Сообщение всем" },
  { href: "/admin/dm", label: "Сообщение", desc: "Лично пользователю" },
  { href: "/admin/leaderboards", label: "Топы", desc: "Активные / лайки / рефералы" },
  { href: "/admin/loners", label: "Одиночки", desc: "Без мэтчей" },
  { href: "/admin/new-today", label: "Новые сегодня", desc: "Регистрации за день" },
];

export default function AdminPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && me && !me.is_admin) router.replace("/swipe");
  }, [me, loading, router]);

  const { data: stats } = useSWR(me?.is_admin ? "admin/stats" : null, () =>
    api.adminStats(),
  );

  return (
    <main className="flex flex-col gap-6">
      <header>
        <span className="label">админ-панель</span>
        <h1 className="display text-4xl">MATCH 57</h1>
        <p className="mt-1 text-sm text-ink-100/70">
          Те же действия, что в Telegram-боте, теперь в нормальном интерфейсе.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="всего" value={stats?.total ?? "—"} />
        <Stat label="парней" value={stats?.guys ?? "—"} />
        <Stat label="девушек" value={stats?.girls ?? "—"} />
        <Stat label="новых сегодня" value={stats?.new_today ?? "—"} />
        <Stat label="лайков" value={stats?.total_likes ?? "—"} />
        <Stat label="мэтчей" value={stats?.total_matches ?? "—"} />
        <Stat
          label="жалоб открыто"
          value={stats?.unresolved_reports ?? "—"}
          warn={(stats?.unresolved_reports ?? 0) > 0}
        />
        <Stat label="забанено" value={stats?.banned ?? "—"} />
      </section>

      <ul className="grid gap-2 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="glass flex items-center justify-between p-5 transition hover:bg-white/[0.07]"
            >
              <div>
                <div className="display text-2xl">{s.label}</div>
                <div className="text-sm text-ink-100/70">{s.desc}</div>
              </div>
              <span className="text-xl text-ink-200/60">→</span>
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
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div
      className={`glass-soft px-4 py-4 ${
        warn ? "border-rose-300/40 bg-rose-500/10" : ""
      }`}
    >
      <div className="display text-3xl">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-ink-200/70">
        {label}
      </div>
    </div>
  );
}

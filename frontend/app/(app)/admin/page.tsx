"use client";

import Link from "next/link";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";

const SECTIONS = [
  { href: "/admin/users", label: "Пользователи", desc: "Список + бан / удаление" },
  { href: "/admin/reports", label: "Жалобы", desc: "Закрыть, забанить" },
  { href: "/admin/broadcast", label: "Рассылка", desc: "Системное сообщение всем" },
  { href: "/admin/leaderboards", label: "Топы", desc: "Лайки / мэтчи / рефералы" },
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
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="всего" value={stats?.total_users ?? "—"} />
        <Stat label="скрыто" value={stats?.hidden ?? "—"} />
        <Stat label="забанено" value={stats?.banned ?? "—"} />
        <Stat label="фото" value={stats?.photo_count ?? "—"} />
        <Stat label="лайков" value={stats?.total_likes ?? "—"} />
        <Stat label="дизлайков" value={stats?.total_dislikes ?? "—"} />
        <Stat label="мэтчей" value={stats?.total_matches ?? "—"} />
        <Stat
          label="жалоб открыто"
          value={stats?.open_reports ?? "—"}
          warn={(stats?.open_reports ?? 0) > 0}
        />
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

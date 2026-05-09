"use client";

import useSWR from "swr";
import Link from "next/link";
import { api } from "@/lib/api";

export default function AdminNewTodayPage() {
  const { data, isLoading } = useSWR("admin/new-today", () =>
    api.adminNewToday(),
  );
  const items = data?.items ?? [];

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">новые сегодня</h1>
        <Link href="/admin" className="btn-ghost">
          ← назад
        </Link>
      </header>

      {isLoading ? <p>Грузим…</p> : null}
      {!isLoading && items.length === 0 ? (
        <p className="text-ink-200/70">сегодня ещё не было регистраций</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {items.map((u) => (
          <li key={u.user_id}>
            <Link
              href={`/admin/users/${u.user_id}`}
              className="glass flex items-center justify-between p-4 transition hover:bg-white/[0.07]"
            >
              <div>
                <div className="display text-xl">
                  {u.name}, {u.age}
                </div>
                <div className="text-xs text-ink-200/70">
                  {u.username ? `@${u.username}` : `id:${u.user_id}`} ·{" "}
                  {new Date(u.created_at).toLocaleTimeString("ru-RU")}
                </div>
              </div>
              <span>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

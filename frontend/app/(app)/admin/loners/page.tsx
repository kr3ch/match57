"use client";

import useSWR from "swr";
import Link from "next/link";
import { api } from "@/lib/api";

export default function AdminLonersPage() {
  const { data, isLoading } = useSWR("admin/loners", () => api.adminLoners());
  const items = data?.items ?? [];

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">одиночки</h1>
        <Link href="/admin" className="btn-ghost">
          ← назад
        </Link>
      </header>
      <p className="text-sm text-ink-100/70">
        У этих ребят пока ноль мэтчей.
      </p>

      {isLoading ? <p>Грузим…</p> : null}
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
                  {u.gender}
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

"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

export default function AdminUsersPage() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useSWR(["admin/users", page], () =>
    api.adminUsers(page),
  );
  const items = data?.items ?? [];

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">пользователи</h1>
        <Link href="/admin" className="btn-ghost">
          ← назад
        </Link>
      </header>

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
                  {u.banned ? (
                    <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-200">
                      бан
                    </span>
                  ) : null}
                  {u.hidden ? (
                    <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5">
                      скрыт
                    </span>
                  ) : null}
                </div>
              </div>
              <span>→</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          className="btn-ghost disabled:opacity-30"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(p - 1, 0))}
        >
          ← пред
        </button>
        <span className="text-sm text-ink-200/70">
          стр. {page + 1} / {Math.ceil((data?.total ?? 0) / (data?.page_size ?? 10)) || 1}
        </span>
        <button
          type="button"
          className="btn-ghost disabled:opacity-30"
          disabled={!data?.has_next}
          onClick={() => setPage((p) => p + 1)}
        >
          след →
        </button>
      </div>
    </main>
  );
}

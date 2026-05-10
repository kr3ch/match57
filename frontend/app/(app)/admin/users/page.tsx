"use client";

import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";

import { api } from "@/lib/api";

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const { data, isLoading } = useSWR(["admin/users", q, cursor], () =>
    api.adminUsers(q, cursor),
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

      <input
        className="input"
        placeholder="email, имя или @username"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setCursor(0);
        }}
      />

      {isLoading ? <p>Грузим…</p> : null}

      <ul className="flex flex-col gap-2">
        {items.map((u) => (
          <li key={u.user_id}>
            <Link
              href={`/admin/user?id=${u.user_id}`}
              className="glass flex items-center justify-between p-4 transition hover:bg-white/[0.07]"
            >
              <div>
                <div className="display text-xl">
                  {u.name}, {u.age}
                </div>
                <div className="text-xs text-ink-200/70">
                  {u.username ? `@${u.username}` : `id:${u.user_id}`} · {u.email ?? ""} · {u.gender}
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
          disabled={cursor === 0}
          onClick={() => setCursor(0)}
        >
          ← в начало
        </button>
        <button
          type="button"
          className="btn-ghost disabled:opacity-30"
          disabled={!data?.next}
          onClick={() => data?.next && setCursor(data.next)}
        >
          след →
        </button>
      </div>
    </main>
  );
}

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
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs text-ink-100/60 transition hover:text-ink-100"
          >
            ← Назад
          </Link>
          <h1 className="display mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Пользователи
          </h1>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs tabular-nums text-ink-100/70">
          {data ? `${items.length}${data.next ? "+" : ""}` : "…"}
        </span>
      </header>

      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-100/40"
        >
          🔍
        </span>
        <input
          className="input pl-10"
          placeholder="email, имя или @username"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
        />
        {q && (
          <button
            type="button"
            aria-label="Очистить"
            onClick={() => {
              setQ("");
              setCursor(0);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/5 px-2 py-0.5 text-xs text-ink-100/60 transition hover:text-ink-50"
          >
            ✕
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {isLoading && items.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <li key={`s-${i}`} className="glass-soft animate-pulse p-4">
                <div className="h-5 w-32 rounded bg-white/10" />
                <div className="mt-2 h-3 w-48 rounded bg-white/5" />
              </li>
            ))
          : items.map((u) => (
              <li key={u.user_id}>
                <Link
                  href={`/admin/user?id=${u.user_id}`}
                  className="glass group flex items-center justify-between gap-3 p-4 transition hover:bg-white/[0.08] active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="display flex items-baseline gap-2 truncate text-lg font-semibold tracking-tight">
                      {u.name}
                      <span className="text-ink-100/50">·</span>
                      <span className="text-ink-100/70">{u.age}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-ink-100/60">
                      {u.username ? `@${u.username}` : `id:${u.user_id}`}
                      {u.email ? ` · ${u.email}` : ""} · {u.gender}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {u.banned && (
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-rose-200">
                          бан
                        </span>
                      )}
                      {u.hidden && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-ink-100/80">
                          скрыт
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-lg text-ink-200/50 transition group-hover:translate-x-0.5 group-hover:text-ink-100">
                    →
                  </span>
                </Link>
              </li>
            ))}
        {!isLoading && items.length === 0 && (
          <li className="glass-soft flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="text-3xl">🤷</span>
            <p className="text-sm text-ink-100/60">
              {q ? "Никого не нашли" : "Пока пусто"}
            </p>
          </li>
        )}
      </ul>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          className="btn-ghost disabled:opacity-30"
          disabled={cursor === 0}
          onClick={() => setCursor(0)}
        >
          ← В начало
        </button>
        <button
          type="button"
          className="btn-ghost disabled:opacity-30"
          disabled={!data?.next}
          onClick={() => data?.next && setCursor(data.next)}
        >
          Дальше →
        </button>
      </div>
    </main>
  );
}

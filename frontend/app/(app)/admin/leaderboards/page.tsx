"use client";

import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";

import { api } from "@/lib/api";

type Tab = "received" | "matches" | "referrers";

const LABEL: Record<Tab, string> = {
  received: "Лайки",
  matches: "Мэтчи",
  referrers: "Рефералы",
};

export default function AdminLeaderboardsPage() {
  const [tab, setTab] = useState<Tab>("received");
  const { data, isLoading } = useSWR(["admin/top", tab], () => {
    if (tab === "received") return api.adminTopReceived();
    if (tab === "matches") return api.adminTopMatches();
    return api.adminTopReferrers();
  });

  const items = data?.items ?? [];

  return (
    <main className="flex flex-col gap-4">
      <header>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-ink-100/60 transition hover:text-ink-100"
        >
          ← Назад
        </Link>
        <h1 className="display mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Топы
        </h1>
      </header>

      <div className="inline-flex w-fit gap-1 rounded-2xl bg-white/[0.04] p-1">
        {(Object.keys(LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-3.5 py-1.5 text-sm font-medium transition ${
              tab === t
                ? "bg-white/[0.08] text-ink-50 shadow-sm"
                : "text-ink-100/60 hover:text-ink-100"
            }`}
          >
            {LABEL[t]}
          </button>
        ))}
      </div>

      {isLoading && items.length === 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="glass-soft animate-pulse flex items-center gap-3 p-4"
            >
              <div className="h-7 w-7 rounded-full bg-white/10" />
              <div className="h-4 flex-1 rounded bg-white/10" />
              <div className="h-5 w-8 rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-soft flex flex-col items-center gap-2 px-4 py-12 text-center">
          <span className="text-3xl">📊</span>
          <p className="text-sm text-ink-100/60">Пока пусто</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((row, i) => (
            <li
              key={row.user_id}
              className="glass flex items-center gap-3 p-4 transition hover:bg-white/[0.07]"
            >
              <span
                className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold ${
                  i === 0
                    ? "bg-ember-400/20 text-ember-200"
                    : i === 1
                    ? "bg-white/10 text-ink-100"
                    : i === 2
                    ? "bg-rose-400/10 text-rose-200"
                    : "bg-white/[0.04] text-ink-200/80"
                }`}
              >
                {i + 1}
              </span>
              <Link
                href={`/admin/user?id=${row.user_id}`}
                className="display flex-1 truncate text-base font-medium transition hover:text-ember-300 sm:text-lg"
              >
                id:{row.user_id}
              </Link>
              <span className="display text-xl font-semibold tabular-nums tracking-tight">
                {row.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

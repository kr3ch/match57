"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

type Tab = "active" | "likes" | "referrers";

const LABEL: Record<Tab, string> = {
  active: "Активные",
  likes: "Топ по лайкам",
  referrers: "Топ рефереров",
};

export default function AdminLeaderboardsPage() {
  const [tab, setTab] = useState<Tab>("active");
  const { data, isLoading } = useSWR(["admin/top", tab], () =>
    api.adminTop(tab),
  );

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">топы</h1>
        <Link href="/admin" className="btn-ghost">
          ← назад
        </Link>
      </header>

      <div className="flex gap-2">
        {(Object.keys(LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded-full border px-4 py-2 text-sm transition ${
              tab === t
                ? "border-ember-400/60 bg-ember-500/15 text-ember-100"
                : "border-white/10 bg-white/[0.03] text-ink-100"
            }`}
            onClick={() => setTab(t)}
          >
            {LABEL[t]}
          </button>
        ))}
      </div>

      {isLoading ? <p>Грузим…</p> : null}
      <ol className="flex flex-col gap-2">
        {(data?.items ?? []).map((u, i) => {
          const value =
            tab === "active"
              ? (u.likes_sent?.length ?? 0) + (u.matches?.length ?? 0)
              : tab === "likes"
                ? u.likes_received?.length ?? 0
                : u.referrals?.length ?? 0;
          return (
            <li key={u.user_id} className="glass flex items-center gap-3 p-4">
              <span className="display text-3xl text-ember-300/70">
                {i + 1}
              </span>
              <div className="flex-1">
                <Link
                  href={`/admin/users/${u.user_id}`}
                  className="display text-xl underline-offset-2 hover:underline"
                >
                  {u.name}, {u.age}
                </Link>
                <div className="text-xs text-ink-200/70">
                  {u.username ? `@${u.username}` : `id:${u.user_id}`}
                </div>
              </div>
              <div className="text-right">
                <div className="display text-2xl">{value}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

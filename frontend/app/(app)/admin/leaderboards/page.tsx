"use client";

import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";

import { api } from "@/lib/api";

type Tab = "received" | "matches";

const LABEL: Record<Tab, string> = {
  received: "Полученные лайки",
  matches: "Мэтчи",
};

export default function AdminLeaderboardsPage() {
  const [tab, setTab] = useState<Tab>("received");
  const { data, isLoading } = useSWR(["admin/top", tab], () => {
    if (tab === "received") return api.adminTopReceived();
    return api.adminTopMatches();
  });

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
        {(data?.items ?? []).map((row, i) => (
          <li key={row.user_id} className="glass flex items-center gap-3 p-4">
            <span className="display text-3xl text-ember-300/70">{i + 1}</span>
            <div className="flex-1">
              <Link
                href={`/admin/users/${row.user_id}`}
                className="display text-xl underline-offset-2 hover:underline"
              >
                {row.name || `id:${row.user_id}`}
              </Link>
            </div>
            <div className="text-right">
              <div className="display text-2xl">{row.count}</div>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}

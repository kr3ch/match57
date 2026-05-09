"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";

export default function AdminSearchPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">поиск</h1>
        <Link href="/admin" className="btn-ghost">
          ← назад
        </Link>
      </header>

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api.adminSearch(q);
            setItems(r.items);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className="input flex-1"
          placeholder="@username, имя или ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "…" : "найти"}
        </button>
      </form>

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
                  {u.username ? `@${u.username}` : `id:${u.user_id}`}
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

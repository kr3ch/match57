"use client";

import Link from "next/link";
import useSWR from "swr";

import { api } from "@/lib/api";
import { useNotifications } from "@/components/providers/NotificationProvider";

export default function AdminReportsPage() {
  const { push } = useNotifications();
  const { data, mutate, isLoading } = useSWR("admin/reports", () =>
    api.adminReports("open"),
  );
  const items = data?.items ?? [];

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">жалобы</h1>
        <Link href="/admin" className="btn-ghost">
          ← назад
        </Link>
      </header>

      {isLoading ? <p>Грузим…</p> : null}

      <ul className="flex flex-col gap-2">
        {items.map((r) => (
          <li key={r.id} className="glass border-rose-300/30 bg-rose-500/5 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="display text-xl">{r.reason}</div>
                <div className="text-xs text-ink-200/70">
                  на{" "}
                  <Link
                    href={`/admin/users/${r.target_user_id}`}
                    className="text-ember-300 underline"
                  >
                    id:{r.target_user_id}
                  </Link>{" "}
                  · от id:{r.from_user_id}
                </div>
                <div className="mt-1 text-[11px] text-ink-200/60">
                  {new Date(r.at).toLocaleString("ru-RU")}
                </div>
              </div>
              <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs text-rose-200">
                {r.status}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={async () => {
                  await api.adminResolveReport(r.id, "resolve");
                  push({ title: "Закрыта" });
                  void mutate();
                }}
              >
                ✓ закрыть
              </button>
              <button
                type="button"
                className="btn-ghost text-rose-200"
                onClick={async () => {
                  if (!confirm("Забанить и закрыть?")) return;
                  await api.adminResolveReport(r.id, "ban");
                  push({ title: "Забанен" });
                  void mutate();
                }}
              >
                🚫 забанить
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

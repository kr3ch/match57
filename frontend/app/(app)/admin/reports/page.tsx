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
      <header className="flex items-center justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs text-ink-100/60 transition hover:text-ink-100"
          >
            ← Назад
          </Link>
          <h1 className="display mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Жалобы
          </h1>
        </div>
        <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs tabular-nums text-rose-200">
          открыто: {items.length}
        </span>
      </header>

      {isLoading && items.length === 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-soft animate-pulse p-4">
              <div className="h-5 w-32 rounded bg-white/10" />
              <div className="mt-2 h-3 w-64 rounded bg-white/5" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="h-9 rounded-xl bg-white/5" />
                <div className="h-9 rounded-xl bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-soft flex flex-col items-center gap-2 px-4 py-12 text-center">
          <span className="text-3xl">🎉</span>
          <p className="text-sm text-ink-100/60">Открытых жалоб нет</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => (
            <li
              key={r.id}
              className="glass border-rose-400/20 bg-rose-500/5 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="display text-lg font-semibold tracking-tight">
                    {r.reason}
                  </div>
                  <div className="mt-1 text-xs text-ink-100/60">
                    на{" "}
                    <Link
                      href={`/admin/user?id=${r.target_user_id}`}
                      className="text-ember-300 underline decoration-ember-300/30 underline-offset-2 transition hover:decoration-ember-300"
                    >
                      id:{r.target_user_id}
                    </Link>{" "}
                    · от id:{r.from_user_id}
                  </div>
                  <div className="mt-1.5 text-[11px] text-ink-200/50">
                    {new Date(r.at).toLocaleString("ru-RU")}
                  </div>
                </div>
                <span className="flex-none rounded-full bg-rose-500/25 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-rose-200">
                  {r.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-2xl bg-white/5 px-3 py-2 text-sm font-medium text-ink-100 transition hover:bg-white/10 active:scale-[0.98]"
                  onClick={async () => {
                    await api.adminResolveReport(r.id, "resolve");
                    push({ title: "Закрыта" });
                    void mutate();
                  }}
                >
                  ✓ Закрыть
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-rose-500/20 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/30 active:scale-[0.98]"
                  onClick={async () => {
                    if (!confirm("Забанить и закрыть?")) return;
                    await api.adminResolveReport(r.id, "ban");
                    push({ title: "Забанен" });
                    void mutate();
                  }}
                >
                  🚫 Забанить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

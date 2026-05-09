"use client";

import useSWR from "swr";
import Link from "next/link";
import { api } from "@/lib/api";
import { toast } from "@/components/Toaster";

export default function AdminReportsPage() {
  const { data, mutate, isLoading } = useSWR("admin/reports", () =>
    api.adminReports(),
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
          <li
            key={r.index}
            className={`glass p-4 ${
              r.resolved ? "opacity-60" : "border-rose-300/30 bg-rose-500/5"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="display text-xl">{r.reason}</div>
                <div className="text-xs text-ink-200/70">
                  на{" "}
                  <Link
                    href={`/admin/users/${r.on}`}
                    className="text-ember-300 underline"
                  >
                    {r.on_name ?? `id:${r.on}`}
                  </Link>{" "}
                  · от{" "}
                  <Link
                    href={`/admin/users/${r.from}`}
                    className="underline"
                  >
                    {r.from_name ?? `id:${r.from}`}
                  </Link>
                </div>
                <div className="mt-1 text-[11px] text-ink-200/60">
                  {new Date(r.at).toLocaleString("ru-RU")}
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  r.resolved
                    ? "bg-white/10 text-ink-100"
                    : "bg-rose-500/20 text-rose-200"
                }`}
              >
                {r.resolved ? "закрыта" : "новая"}
              </span>
            </div>

            {!r.resolved && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={async () => {
                    await api.adminResolve(r.index);
                    toast({ title: "Закрыта" });
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
                    await api.adminBanFromReport(r.index);
                    toast({ title: "Забанен и закрыто" });
                    void mutate();
                  }}
                >
                  🚫 бан
                </button>
                <button
                  type="button"
                  className="btn-rose"
                  onClick={async () => {
                    if (!confirm("Удалить анкету и закрыть?")) return;
                    await api.adminDeleteFromReport(r.index);
                    toast({ title: "Удалено и закрыто" });
                    void mutate();
                  }}
                >
                  ✕ удалить
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

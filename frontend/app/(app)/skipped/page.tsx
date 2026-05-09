"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { toast } from "@/components/Toaster";

export default function SkippedPage() {
  const { data, mutate, isLoading } = useSWR("skipped", () => api.skipped());
  const [busy, setBusy] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  const items = data?.items ?? [];

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="display text-4xl">отвергнутые</h1>
          <p className="mt-1 text-sm text-ink-100/70">
            Те, кого ты пропустил. Можно дать второй шанс.
          </p>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            disabled={clearing}
            className="btn-ghost text-rose-200 disabled:opacity-40"
            onClick={async () => {
              if (!confirm("Очистить весь список отвергнутых?")) return;
              setClearing(true);
              try {
                const r = await api.clearSkipped();
                toast({ title: `Очищено: ${r.removed}` });
                await mutate();
              } finally {
                setClearing(false);
              }
            }}
          >
            очистить
          </button>
        ) : null}
      </header>

      {isLoading && <p className="text-ink-200/60">Грузим…</p>}
      {!isLoading && items.length === 0 ? (
        <div className="glass px-5 py-8 text-center">
          <p className="display text-2xl">никого нет</p>
          <p className="mt-2 text-ink-100/80">
            Никого не пропускал — или уже всех вернул.
          </p>
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((p) => (
          <motion.li
            layout
            key={p.user_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass relative overflow-hidden p-3"
          >
            <div className="aspect-[3/4] overflow-hidden rounded-2xl">
              {p.photos[0]?.type === "video" ? (
                <video
                  src={mediaUrl(p.photos[0].file_id)}
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : p.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(p.photos[0].file_id)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-ink-200/60">
                  без фото
                </div>
              )}
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="display text-2xl">
                {p.name}, {p.age}
              </span>
              <span className="text-xs text-ink-200/60">
                {p.gender === "Девушка" ? "♀" : "♂"}
              </span>
            </div>
            <button
              type="button"
              disabled={busy === p.user_id}
              className="btn-primary mt-3 w-full disabled:opacity-50"
              onClick={async () => {
                setBusy(p.user_id);
                try {
                  const r = await api.like(p.user_id);
                  if (r.match) {
                    toast({
                      title: "Мэтч!",
                      body: r.contact ?? "",
                      tone: "match",
                    });
                  } else {
                    toast({ title: "Лайк отправлен" });
                  }
                  await mutate();
                } catch (e) {
                  toast({ title: "Ошибка", body: (e as Error).message, tone: "error" });
                } finally {
                  setBusy(null);
                }
              }}
            >
              ❤ дать шанс
            </button>
          </motion.li>
        ))}
      </ul>
    </main>
  );
}

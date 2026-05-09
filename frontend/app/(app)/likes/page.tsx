"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { toast } from "@/components/Toaster";

export default function LikesPage() {
  const { data, mutate, isLoading } = useSWR("likes/incoming", () =>
    api.incomingLikes(),
  );
  const [busy, setBusy] = useState<number | null>(null);

  const items = data?.items ?? [];

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">тебя лайкнули</h1>
        <span className="pill">{items.length}</span>
      </header>

      {isLoading ? <Skeleton /> : null}
      {!isLoading && items.length === 0 ? (
        <div className="glass px-5 py-8 text-center">
          <p className="display text-2xl">пока пусто</p>
          <p className="mt-2 text-ink-100/80">
            Свайпай — и тебя начнут видеть.
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
            {p.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-ink-100/80">
                {p.description}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy === p.user_id}
                className="btn-primary flex-1 disabled:opacity-50"
                onClick={async () => {
                  setBusy(p.user_id);
                  try {
                    const r = await api.like(p.user_id);
                    if (r.match) {
                      toast({
                        title: "Взаимная симпатия!",
                        body: r.contact ?? "",
                        tone: "match",
                      });
                    } else {
                      toast({ title: "Лайк отправлен" });
                    }
                    await mutate();
                  } catch (e) {
                    toast({
                      title: "Ошибка",
                      body: (e as Error).message,
                      tone: "error",
                    });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                ❤ лайкнуть в ответ
              </button>
              <button
                type="button"
                disabled={busy === p.user_id}
                className="btn-ghost px-4 disabled:opacity-50"
                onClick={async () => {
                  setBusy(p.user_id);
                  try {
                    await api.dislike(p.user_id);
                    toast({ title: "Пропустил" });
                    await mutate();
                  } catch (e) {
                    toast({ title: "Ошибка", body: (e as Error).message, tone: "error" });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                ✕
              </button>
            </div>
          </motion.li>
        ))}
      </ul>
    </main>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="glass aspect-[3/5] animate-pulse opacity-60"
        />
      ))}
    </div>
  );
}

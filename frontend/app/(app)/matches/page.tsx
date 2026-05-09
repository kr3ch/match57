"use client";

import useSWR from "swr";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

export default function MatchesPage() {
  const { data, isLoading } = useSWR("matches", () => api.matches());
  const items = data?.items ?? [];

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="display text-4xl">мэтчи</h1>
        <p className="mt-1 text-sm text-ink-100/70">
          Те, кто лайкнул тебя в ответ. Пиши в Telegram.
        </p>
      </header>

      {isLoading ? <p className="text-ink-200/60">Грузим…</p> : null}
      {!isLoading && items.length === 0 ? (
        <div className="glass px-5 py-8 text-center">
          <p className="display text-2xl">пусто</p>
          <p className="mt-2 text-ink-100/80">
            Свайпай дальше — каждый день кто-то залетает.
          </p>
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((m, i) => (
          <motion.li
            key={m.user_id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass flex items-center gap-3 p-3"
          >
            <div className="h-16 w-16 flex-none overflow-hidden rounded-2xl bg-ink-700/60">
              {m.photos[0] ? (
                m.photos[0].type === "video" ? (
                  <video
                    src={mediaUrl(m.photos[0].file_id)}
                    className="h-full w-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(m.photos[0].file_id)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )
              ) : null}
            </div>
            <div className="flex-1">
              <div className="display text-xl">
                {m.name}, {m.age}
              </div>
              {m.username ? (
                <a
                  className="text-sm text-ember-300 underline"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://t.me/${m.username}`}
                >
                  @{m.username} →
                </a>
              ) : (
                <span className="text-xs text-ink-200/60">
                  напиши в Telegram сам — username скрыт
                </span>
              )}
            </div>
          </motion.li>
        ))}
      </ul>
    </main>
  );
}

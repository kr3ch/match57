"use client";

import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";

import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { useRealtime } from "@/components/providers/RealtimeProvider";

export default function MatchesPage() {
  const { data, isLoading } = useSWR("matches", () => api.matches());
  const { online } = useRealtime();
  const items = data?.items ?? [];

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="display text-4xl">мэтчи</h1>
        <p className="mt-1 text-sm text-ink-100/70">
          Те, кто лайкнул тебя в ответ. Жми на анкету — попадёшь в чат.
        </p>
      </header>

      {isLoading && items.length === 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="glass-soft flex animate-pulse items-center gap-3 p-3"
            >
              <div className="h-16 w-16 flex-none rounded-2xl bg-white/10" />
              <div className="flex-1">
                <div className="h-5 w-32 rounded bg-white/10" />
                <div className="mt-2 h-3 w-20 rounded bg-white/5" />
              </div>
              <div className="h-9 w-16 rounded-2xl bg-white/10" />
            </li>
          ))}
        </ul>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <div className="glass-soft flex flex-col items-center gap-3 px-5 py-12 text-center">
          <span className="text-4xl">🔥</span>
          <p className="display text-xl font-semibold tracking-tight">
            Пока пусто
          </p>
          <p className="max-w-xs text-sm text-ink-100/70">
            Свайпай дальше — каждый день кто-то залетает.
          </p>
          <Link href="/swipe" className="btn-primary mt-1 !py-2 !px-4 text-sm">
            Свайпать →
          </Link>
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((m, i) => {
          const isOnline = online.has(m.user.user_id) || m.online;
          const photo = m.user.photos[0];
          return (
            <motion.li
              key={m.match_id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass flex items-center gap-3 p-3"
            >
              <div className="relative h-16 w-16 flex-none overflow-hidden rounded-2xl bg-ink-700/60">
                {photo ? (
                  photo.kind === "video" ? (
                    <video
                      src={mediaUrl(photo.user_id, photo.filename)}
                      className="h-full w-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(photo.user_id, photo.filename)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )
                ) : null}
                {isOnline && (
                  <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-ink-900" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="display text-xl">
                  {m.user.name}, {m.user.age}
                </div>
                {m.user.username && (
                  <div className="text-xs text-ink-200/60">@{m.user.username}</div>
                )}
              </div>
              {m.conversation_id ? (
                <Link
                  href={`/chat?id=${m.conversation_id}`}
                  className="btn-primary px-4"
                >
                  Чат →
                </Link>
              ) : (
                <span className="text-xs text-ink-200/60">…</span>
              )}
            </motion.li>
          );
        })}
      </ul>
    </main>
  );
}

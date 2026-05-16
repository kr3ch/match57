"use client";

import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";

import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { formatLastSeen, useTicker } from "@/lib/presence";
import { AdminBadge } from "@/components/AdminBadge";
import { useRealtime } from "@/components/providers/RealtimeProvider";

export default function MatchesPage() {
  const { data, isLoading } = useSWR("matches", () => api.matches());
  const { online } = useRealtime();
  useTicker(30_000);
  const items = data?.items ?? [];

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="display text-4xl">мэтчи</h1>
        <p className="mt-1 text-sm text-ink-100/70">
          Те, кто лайкнул тебя в ответ. Жми на анкету — попадёшь в чат.
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
                <div className="display flex items-center gap-2 text-xl">
                  <span className="truncate">
                    {m.user.name}, {m.user.age}
                  </span>
                  {m.user.is_admin ? <AdminBadge size="xs" /> : null}
                </div>
                {m.user.username && (
                  <div className="text-xs text-ink-200/60">@{m.user.username}</div>
                )}
                <div className="text-[11px] text-ink-200/60">
                  {isOnline
                    ? "в сети"
                    : m.user.last_seen_at
                      ? `был(а) ${formatLastSeen(m.user.last_seen_at)}`
                      : "не в сети"}
                </div>
              </div>
              {m.conversation_id ? (
                <Link
                  href={`/chats/${m.conversation_id}`}
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

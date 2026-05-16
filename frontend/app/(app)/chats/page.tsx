"use client";

import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";
import { useEffect } from "react";

import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { formatLastSeen, useTicker } from "@/lib/presence";
import type { ConversationListItem } from "@/lib/types";
import { AdminBadge } from "@/components/AdminBadge";
import { useRealtime } from "@/components/providers/RealtimeProvider";

export default function ChatsPage() {
  const { data, mutate, isLoading } = useSWR(
    "conversations",
    () => api.conversations(),
    { refreshInterval: 30000 },
  );
  const { subscribe, online } = useRealtime();
  // Keep the "N мин" labels fresh between full refetches.
  useTicker(30_000);

  useEffect(() => {
    return subscribe((evt) => {
      if (evt.type === "message" || evt.type === "read") {
        void mutate();
      }
    });
  }, [subscribe, mutate]);

  const items = (data?.items ?? []).filter(
    (c): c is ConversationListItem & { other: NonNullable<ConversationListItem["other"]> } =>
      c.other != null,
  );

  return (
    <main className="flex flex-col gap-4">
      <header>
        <h1 className="display text-4xl">чаты</h1>
        <p className="mt-1 text-sm text-ink-100/70">
          С кем мэтч — с тем и пишешь.
        </p>
      </header>

      {isLoading && <p className="text-ink-200/60">Грузим…</p>}
      {!isLoading && items.length === 0 ? (
        <div className="glass px-5 py-8 text-center">
          <p className="display text-2xl">пусто</p>
          <p className="mt-2 text-ink-100/80">
            Получи первый мэтч — и сразу появится переписка.
          </p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {items.map((c, i) => {
          const isOnline = online.has(c.other.user_id) || c.other.online;
          const last = c.last_message;
          const preview =
            !last ? "—" :
            last.kind === "text" ? last.body || "" :
            last.kind === "voice" ? "🎙 голосовое" :
            last.kind === "video" ? "📹 видео" :
            last.kind === "photo" ? "📷 фото" :
            "📎 файл";
          return (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link
                href={`/chats/${c.id}`}
                className="glass flex items-center gap-3 p-3 hover:bg-white/5"
              >
                <div className="relative h-14 w-14 flex-none overflow-hidden rounded-2xl bg-ink-700/60">
                  {c.other.avatar ? (
                    c.other.avatar.kind === "video" ? (
                      <video
                        src={mediaUrl(c.other.avatar.user_id, c.other.avatar.filename)}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl(c.other.avatar.user_id, c.other.avatar.filename)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-200/60">
                      ?
                    </div>
                  )}
                  {isOnline && (
                    <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-ink-900" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="display truncate text-base">
                        {c.other.name}
                        {c.other.age ? `, ${c.other.age}` : ""}
                      </span>
                      {c.other.is_admin ? <AdminBadge size="xs" /> : null}
                    </span>
                    {c.last_message_at && (
                      <span className="shrink-0 text-[11px] text-ink-200/60">
                        {timeAgo(c.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm text-ink-100/70">
                      {preview}
                    </p>
                    {c.unread_count > 0 && (
                      <span className="rounded-full bg-ember-500 px-2 py-0.5 text-xs font-bold text-ink-950">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-200/60">
                    {isOnline
                      ? "в сети"
                      : c.other.last_seen_at
                        ? `был(а) ${formatLastSeen(c.other.last_seen_at)}`
                        : "не в сети"}
                  </div>
                </div>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </main>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

function timeAgo(iso: string) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  if (diff < 60_000) return "только что";
  if (diff < 3600_000) return plural(Math.floor(diff / 60_000), "мин", "мин", "мин") + " назад";
  if (diff < 86400_000) return plural(Math.floor(diff / 3600_000), "час", "часа", "часов") + " назад";
  return plural(Math.floor(diff / 86400_000), "день", "дня", "дней") + " назад";
}

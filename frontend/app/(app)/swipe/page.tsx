"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { APIError, api } from "@/lib/api";
import type { PublicProfile } from "@/lib/types";
import { SwipeCard } from "@/components/SwipeCard";
import { ReportDialog } from "@/components/ReportDialog";
import { useNotifications } from "@/components/providers/NotificationProvider";

export default function SwipePage() {
  const router = useRouter();
  const { push } = useNotifications();
  const [deck, setDeck] = useState<PublicProfile[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const refill = useCallback(async () => {
    try {
      const r = await api.browse({ limit: 12 });
      setDeck(r.items);
      setExhausted(r.items.length === 0);
    } catch (e) {
      if (e instanceof APIError) {
        push({ title: "Не получилось загрузить", body: e.detail });
      }
    }
  }, [push]);

  useEffect(() => {
    void refill();
  }, [refill]);

  const top = deck[0];

  const handleDecision = useCallback(
    async (kind: "like" | "dislike") => {
      if (!top || busy) return;
      setBusy(true);
      try {
        if (kind === "like") {
          const r = await api.like(top.user_id);
          if (r.matched && r.conversation_id) {
            push({
              title: `Мэтч с ${top.name}!`,
              body: "Открыть чат?",
              href: `/chat?id=${r.conversation_id}`,
            });
          }
        } else {
          await api.dislike(top.user_id);
        }
        setDeck((prev) => prev.slice(1));
        if (deck.length <= 2) {
          await refill();
        }
      } catch (e) {
        if (e instanceof APIError) {
          push({ title: "Не получилось", body: e.detail });
        }
      } finally {
        setBusy(false);
      }
    },
    [top, busy, deck.length, refill, push],
  );

  if (exhausted && deck.length === 0) {
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-6 px-4 text-center">
        <span className="display text-6xl">кончились…</span>
        <p className="max-w-sm text-ink-100/80">
          Анкеты закончились — но никто не уходит. Загляни через час, или
          посмотри отвергнутых.
        </p>
        <div className="flex gap-3">
          <button type="button" className="btn-ghost" onClick={() => void refill()}>
            Проверить ещё раз
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => router.push("/skipped")}
          >
            Скип
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[80dvh] flex-col">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="display text-3xl">найди своих</h1>
        <span className="pill">свайп · ←/→ · R жалоба</span>
      </header>

      <section className="relative mx-auto h-[68dvh] w-full max-w-md">
        {deck
          .slice(0, 3)
          .reverse()
          .map((profile, revIdx) => {
            const stackIdx = Math.min(deck.length, 3) - 1 - revIdx;
            const isTop = stackIdx === 0;
            return (
              <SwipeCard
                key={profile.user_id}
                profile={profile}
                caption=""
                index={stackIdx}
                isTop={isTop}
                onDecision={(d) => {
                  if (d === "like" || d === "dislike") void handleDecision(d);
                }}
                onMessage={() => {
                  void handleDecision("like");
                }}
                onReport={() => setReportOpen(true)}
              />
            );
          })}
      </section>

      <ActionBar
        disabled={!top || busy}
        onDislike={() => void handleDecision("dislike")}
        onLike={() => void handleDecision("like")}
        onReport={() => setReportOpen(true)}
      />

      <ReportDialog
        open={reportOpen && !!top}
        onClose={() => setReportOpen(false)}
        targetUserId={top?.user_id ?? null}
        onSent={() => setReportOpen(false)}
      />
    </main>
  );
}

function ActionBar({
  disabled,
  onDislike,
  onLike,
  onReport,
}: {
  disabled: boolean;
  onDislike: () => void;
  onLike: () => void;
  onReport: () => void;
}) {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-md items-center justify-center gap-4">
      <button
        type="button"
        className="btn-ghost h-14 w-14 rounded-full text-2xl"
        onClick={onDislike}
        disabled={disabled}
        aria-label="Дизлайк"
      >
        ✕
      </button>
      <button
        type="button"
        className="btn-rose h-14 w-14 rounded-full text-2xl"
        onClick={onReport}
        disabled={disabled}
        aria-label="Жалоба"
      >
        ⚑
      </button>
      <button
        type="button"
        className="btn-primary h-16 w-16 rounded-full text-2xl"
        onClick={onLike}
        disabled={disabled}
        aria-label="Лайк"
      >
        ❤
      </button>
    </div>
  );
}

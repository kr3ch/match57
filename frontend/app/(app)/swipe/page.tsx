"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { PublicProfile } from "@/lib/types";
import { SwipeCard } from "@/components/SwipeCard";
import { Modal } from "@/components/Modal";
import { MessageComposer } from "@/components/MessageComposer";
import { ReportDialog } from "@/components/ReportDialog";
import { toast } from "@/components/Toaster";

type DeckEntry = { profile: PublicProfile; caption: string; index: number };

export default function SwipePage() {
  const [deck, setDeck] = useState<DeckEntry[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const loadAt = useCallback(async (index: number) => {
    const r = await api.next(index);
    if (!r.profile) {
      setExhausted(true);
      return null;
    }
    setExhausted(false);
    return { profile: r.profile, caption: r.caption ?? "", index: r.index };
  }, []);

  const refill = useCallback(async () => {
    const first = await loadAt(0);
    if (!first) return;
    const second = await loadAt(first.index + 1);
    setDeck(second ? [first, second] : [first]);
  }, [loadAt]);

  useEffect(() => {
    void refill();
  }, [refill]);

  const top = deck[0];

  const advance = useCallback(async () => {
    setDeck((prev) => prev.slice(1));
    const lastIndex = deck[deck.length - 1]?.index;
    const nextIdx = (lastIndex ?? -1) + 1;
    const candidate = await loadAt(nextIdx);
    if (candidate) {
      setDeck((prev) => [...prev, candidate]);
    }
  }, [deck, loadAt]);

  const handleDecision = useCallback(
    async (kind: "like" | "dislike") => {
      if (!top || busy) return;
      setBusy(true);
      try {
        if (kind === "like") {
          const r = await api.like(top.profile.user_id);
          if (r.match) {
            toast({
              title: "Взаимная симпатия!",
              body: r.contact ?? "Контакт отправлен в Telegram.",
              tone: "match",
            });
          }
        } else {
          await api.dislike(top.profile.user_id);
        }
        await advance();
      } catch (e) {
        toast({
          title: "Не получилось",
          body: (e as Error).message,
          tone: "error",
        });
      } finally {
        setBusy(false);
      }
    },
    [top, busy, advance],
  );

  if (exhausted && deck.length === 0) {
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-6 px-4 text-center">
        <span className="display text-6xl">кончились…</span>
        <p className="max-w-sm text-ink-100/80">
          Анкеты закончились — но никто не уходит. Загляни через час, или
          посмотри отвергнутых.
        </p>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void refill()}
        >
          Проверить ещё раз
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-[80dvh] flex-col">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="display text-3xl">найди своих</h1>
        <span className="pill">свайп · ←/→ · enter сообщение</span>
      </header>

      <section className="relative mx-auto h-[68dvh] w-full max-w-md">
        {deck
          .slice()
          .reverse()
          .map((entry, revIdx) => {
            const stackIdx = deck.length - 1 - revIdx;
            const isTop = stackIdx === 0;
            return (
              <SwipeCard
                key={entry.profile.user_id}
                profile={entry.profile}
                caption={entry.caption}
                index={stackIdx}
                isTop={isTop}
                onDecision={(d) => {
                  if (d === "like" || d === "dislike") void handleDecision(d);
                }}
                onMessage={() => setMessageOpen(true)}
                onReport={() => setReportOpen(true)}
              />
            );
          })}
      </section>

      <ActionBar
        disabled={!top || busy}
        onDislike={() => void handleDecision("dislike")}
        onMessage={() => setMessageOpen(true)}
        onLike={() => void handleDecision("like")}
        onReport={() => setReportOpen(true)}
      />

      <Modal
        open={messageOpen && !!top}
        onClose={() => setMessageOpen(false)}
        title={top ? `Сообщение для ${top.profile.name}` : ""}
      >
        {top ? (
          <MessageComposer
            targetUserId={top.profile.user_id}
            onSent={async () => {
              setMessageOpen(false);
              await advance();
            }}
          />
        ) : null}
      </Modal>

      <ReportDialog
        open={reportOpen && !!top}
        onClose={() => setReportOpen(false)}
        targetUserId={top?.profile.user_id ?? null}
      />
    </main>
  );
}

function ActionBar({
  disabled,
  onDislike,
  onMessage,
  onLike,
  onReport,
}: {
  disabled: boolean;
  onDislike: () => void;
  onMessage: () => void;
  onLike: () => void;
  onReport: () => void;
}) {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-md items-center justify-between gap-3">
      <ActionButton
        label="Мимо"
        symbol="✕"
        onClick={onDislike}
        disabled={disabled}
        tone="rose"
      />
      <ActionButton
        label="Написать"
        symbol="✉"
        onClick={onMessage}
        disabled={disabled}
      />
      <ActionButton
        label="Лайк"
        symbol="❤"
        onClick={onLike}
        disabled={disabled}
        tone="ember"
        prominent
      />
      <ActionButton
        label="Жалоба"
        symbol="!"
        onClick={onReport}
        disabled={disabled}
      />
    </div>
  );
}

function ActionButton({
  label,
  symbol,
  onClick,
  disabled,
  tone,
  prominent,
}: {
  label: string;
  symbol: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "rose" | "ember";
  prominent?: boolean;
}) {
  const sizeBase = prominent ? "h-16 w-16 sm:h-20 sm:w-20" : "h-12 w-12 sm:h-14 sm:w-14";
  const baseGlass = "border-white/10 bg-white/[0.04] text-ink-50 hover:bg-white/[0.08]";
  const roseGlass = "border-rose-300/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15";
  const emberGlass = "border-ember-300/40 bg-ember-500/15 text-ember-100 hover:bg-ember-500/25";
  const tonal =
    tone === "rose" ? roseGlass : tone === "ember" ? emberGlass : baseGlass;
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 disabled:opacity-40`}
    >
      <span
        className={`flex ${sizeBase} items-center justify-center rounded-full border backdrop-blur-md ${tonal} ${
          prominent ? "text-2xl shadow-card" : "text-xl"
        }`}
      >
        {symbol}
      </span>
      <span className="text-[11px] uppercase tracking-[0.18em] text-ink-200/80">
        {label}
      </span>
    </motion.button>
  );
}

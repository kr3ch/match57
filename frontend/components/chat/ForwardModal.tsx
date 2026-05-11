"use client";

import { useEffect, useState } from "react";

import { APIError, api } from "@/lib/api";
import type { ConversationListItem } from "@/lib/types";
import { mediaUrl } from "@/lib/media";
import { useNotifications } from "@/components/providers/NotificationProvider";

export function ForwardModal({
  messageId,
  currentConversationId,
  onClose,
}: {
  messageId: number;
  currentConversationId: number;
  onClose: () => void;
}) {
  const { push } = useNotifications();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [sending, setSending] = useState<number | null>(null);

  useEffect(() => {
    api
      .conversations()
      .then(({ items }) =>
        setConversations(items.filter((c) => c.id !== currentConversationId)),
      )
      .catch(() => {});
  }, [currentConversationId]);

  async function forward(convId: number) {
    setSending(convId);
    try {
      await api.forwardMessage(messageId, convId);
      push({ title: "Переслано", body: "" });
      onClose();
    } catch (e) {
      if (e instanceof APIError) push({ title: "Ошибка", body: e.detail });
      setSending(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="glass mx-4 mb-4 w-full max-w-md overflow-hidden rounded-2xl sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="display text-lg">Переслать</h2>
          <button type="button" className="btn-ghost px-2 py-1" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-200/60">
              Нет доступных чатов
            </p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={sending !== null}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/5 disabled:opacity-50"
                onClick={() => forward(c.id)}
              >
                <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-ink-700/60">
                  {c.other?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(c.other.avatar.user_id, c.other.avatar.filename)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-200/60">
                      ?
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink-50">
                    {c.other?.name ?? "???"}
                  </div>
                </div>
                {sending === c.id && (
                  <span className="text-xs text-ink-200/60 animate-pulse">
                    отправка…
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { APIError, api } from "@/lib/api";
import type { ChatMessage, ConversationListItem } from "@/lib/types";
import { mediaUrl } from "@/lib/media";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer } from "@/components/chat/Composer";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";

export default function ChatPage() {
  const sp = useSearchParams();
  const conversationId = Number(sp.get("id") ?? "");
  const router = useRouter();
  const { me } = useAuth();
  const { push } = useNotifications();
  const { send, subscribe, online } = useRealtime();

  const [conv, setConv] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingClearRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversation + history once.
  useEffect(() => {
    let mounted = true;
    if (!Number.isFinite(conversationId)) {
      router.replace("/chats");
      return;
    }
    Promise.all([
      api.conversation(conversationId),
      api.history(conversationId, { limit: 50 }),
    ])
      .then(([c, h]) => {
        if (!mounted) return;
        setConv(c.conversation);
        setMessages(h.items);
      })
      .catch((e) => {
        if (e instanceof APIError) {
          push({ title: "Чат недоступен", body: e.detail });
          router.replace("/chats");
        }
      });
    return () => {
      mounted = false;
    };
  }, [conversationId, router, push]);

  // Scroll to bottom on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Mark messages read on arrival, both via REST & per-message WS.
  const markRead = useCallback(() => {
    api.markRead(conversationId).catch(() => {});
    messages.forEach((m) => {
      if (m.from_user_id !== me?.user_id && m.read_by.length === 0) {
        send({ type: "read", message_id: m.id });
      }
    });
  }, [conversationId, messages, me, send]);

  useEffect(() => {
    if (messages.length > 0) markRead();
  }, [messages.length, markRead]);

  // WebSocket events for this chat.
  useEffect(() => {
    return subscribe((evt) => {
      if (evt.type === "message" && evt.message.conversation_id === conversationId) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === evt.message.id);
          if (exists) return prev.map((m) => (m.id === evt.message.id ? evt.message : m));
          return [...prev, evt.message];
        });
      } else if (evt.type === "typing" && evt.conversation_id === conversationId) {
        if (evt.user_id !== me?.user_id) {
          setOtherTyping(evt.is_typing);
          if (typingClearRef.current) clearTimeout(typingClearRef.current);
          if (evt.is_typing) {
            typingClearRef.current = window.setTimeout(() => setOtherTyping(false), 4000);
          }
        }
      } else if (evt.type === "read" && evt.conversation_id === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === evt.message_id
              ? {
                  ...m,
                  read_by: m.read_by.some((r) => r.user_id === evt.user_id)
                    ? m.read_by
                    : [...m.read_by, { user_id: evt.user_id, read_at: new Date().toISOString() }],
                }
              : m,
          ),
        );
      } else if (evt.type === "reaction") {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== evt.message_id) return m;
            const filtered = m.reactions.filter(
              (r) => !(r.user_id === evt.user_id && r.emoji === evt.emoji),
            );
            // Server is authoritative; rebuild the entry deterministically
            // so a previously-applied optimistic update converges.
            return {
              ...m,
              reactions: evt.removed
                ? filtered
                : [...filtered, { user_id: evt.user_id, emoji: evt.emoji }],
            };
          }),
        );
      }
    });
  }, [subscribe, conversationId, me]);

  const otherOnline = useMemo(() => {
    if (!conv?.other_user) return false;
    return online.has(conv.other_user.user_id) || conv.other_user.online;
  }, [conv, online]);

  if (!conv?.other_user) {
    return <p className="text-ink-200/60">Грузим…</p>;
  }
  const other = conv.other_user;

  return (
    <main className="fixed inset-y-0 left-1/2 z-30 flex w-full max-w-2xl -translate-x-1/2 flex-col bg-ink-950 shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/5 bg-ink-950/85 px-4 py-3 backdrop-blur">
        <Link href="/chats" className="btn-ghost h-10 w-10 justify-center px-0">
          ←
        </Link>
        <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-ink-700/60">
          {other.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(other.avatar.user_id, other.avatar.filename)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-200/60">?</div>
          )}
          {otherOnline && (
            <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-ink-900" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="display text-lg leading-tight">
            {other.name}
            {other.age ? `, ${other.age}` : ""}
          </div>
          <div className="text-[11px] text-ink-200/60">
            {otherTyping ? "печатает…" : otherOnline ? "онлайн" : other.last_seen_at ? `был(а) ${new Date(other.last_seen_at).toLocaleString("ru-RU")}` : "не в сети"}
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-2"
      >
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            isMine={m.from_user_id === me?.user_id}
            onReply={() => setReply(m)}
            onReact={(emoji) => {
              if (!me) return;
              const meId = me.user_id;
              // Optimistic toggle: react instantly, then let the server's
              // WS echo normalise. Avoids the 1-2s perceived lag.
              setMessages((prev) =>
                prev.map((x) => {
                  if (x.id !== m.id) return x;
                  const had = x.reactions.some(
                    (r) => r.user_id === meId && r.emoji === emoji,
                  );
                  return {
                    ...x,
                    reactions: had
                      ? x.reactions.filter(
                          (r) => !(r.user_id === meId && r.emoji === emoji),
                        )
                      : [...x.reactions, { user_id: meId, emoji }],
                  };
                }),
              );
              api.reactMessage(m.id, emoji).catch((e) => {
                if (e instanceof APIError) push({ title: "Ошибка", body: e.detail });
              });
            }}
            onDelete={() => {
              api.deleteMessage(m.id).catch((e) => {
                if (e instanceof APIError) push({ title: "Ошибка", body: e.detail });
              });
            }}
            showRead
          />
        ))}
        {messages.length === 0 && (
          <p className="self-center pt-12 text-sm text-ink-200/60">
            ничего не написано — будь первым
          </p>
        )}
      </div>

      <Composer
        conversationId={conversationId}
        replyTo={reply}
        onSent={(m) => {
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          );
        }}
        onClearReply={() => setReply(null)}
      />
    </main>
  );
}

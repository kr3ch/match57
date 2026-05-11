"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { APIError, api } from "@/lib/api";
import type { ChatMessage, ConversationListItem } from "@/lib/types";
import { mediaUrl } from "@/lib/media";
import { presenceLabel, useTicker } from "@/lib/presence";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer } from "@/components/chat/Composer";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";

// Coalesce mark-read POSTs. The server side is idempotent and broadcasts no
// events when nothing new was marked, so we just need to make sure we don't
// hit the endpoint more than once per ~1.5s of activity.
const MARK_READ_DEBOUNCE_MS = 1500;

export default function ChatPage({ params }: { params: { id: string } }) {
  const conversationId = Number(params.id);
  const router = useRouter();
  const { me } = useAuth();
  const { push } = useNotifications();
  const { subscribe, online, reconnectNonce } = useRealtime();

  const [conv, setConv] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingClearRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark-read coordination.
  const markReadTimerRef = useRef<number | null>(null);
  const markReadInFlightRef = useRef(false);
  const markReadPendingRef = useRef(false);
  const lastMarkedAtRef = useRef(0);

  // Load conversation + history. Re-runs on reconnect so we never miss
  // messages that arrived while the socket was bouncing.
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
        // Merge with anything already in state so optimistic / WS-pushed
        // entries aren't blown away by a refetch.
        setMessages((prev) => {
          const byId = new Map<number, ChatMessage>();
          for (const m of h.items) byId.set(m.id, m);
          for (const m of prev) {
            const existing = byId.get(m.id);
            if (!existing) byId.set(m.id, m);
          }
          return Array.from(byId.values()).sort((a, b) =>
            a.created_at < b.created_at ? -1 : 1,
          );
        });
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
    // reconnectNonce intentionally in deps: refetch on WS reconnect.
  }, [conversationId, router, push, reconnectNonce]);

  // Scroll to bottom on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Mark unread messages read — coalesced so we don't trip the rate limiter.
  // The previous version recreated this callback on every messages mutation
  // (including WS-pushed read receipts), which produced a tight POST loop and
  // the 429 stream the user reported.
  useEffect(() => {
    if (!me || messages.length === 0) return;
    const hasUnread = messages.some(
      (m) => m.from_user_id !== me.user_id && (m.read_by ?? []).length === 0,
    );
    if (!hasUnread) return;

    const fire = async () => {
      if (markReadInFlightRef.current) {
        markReadPendingRef.current = true;
        return;
      }
      markReadInFlightRef.current = true;
      markReadPendingRef.current = false;
      lastMarkedAtRef.current = Date.now();
      try {
        await api.markRead(conversationId);
      } catch {
        // Silent — endpoint is idempotent, next visibility/event retries.
      } finally {
        markReadInFlightRef.current = false;
        if (markReadPendingRef.current) {
          markReadPendingRef.current = false;
          if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
          markReadTimerRef.current = window.setTimeout(fire, MARK_READ_DEBOUNCE_MS);
        }
      }
    };

    // First hit can go through immediately; subsequent ones inside the
    // debounce window are collapsed into a single trailing call.
    const sinceLast = Date.now() - lastMarkedAtRef.current;
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    if (sinceLast >= MARK_READ_DEBOUNCE_MS && !markReadInFlightRef.current) {
      void fire();
    } else {
      markReadTimerRef.current = window.setTimeout(fire, MARK_READ_DEBOUNCE_MS);
    }
    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    };
  }, [conversationId, messages, me]);

  // Mark-read on tab focus regain (after backgrounding).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Force a debounced fire by bumping the in-flight gate — handled via
      // a fresh POST that the effect above retries safely.
      api.markRead(conversationId).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversationId]);

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
                  read_by: (m.read_by ?? []).includes(evt.user_id)
                    ? m.read_by
                    : [...(m.read_by ?? []), evt.user_id],
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
            return {
              ...m,
              reactions: evt.removed ? filtered : [...filtered, { user_id: evt.user_id, emoji: evt.emoji }],
            };
          }),
        );
      } else if (evt.type === "presence") {
        // Keep conv.other.last_seen_at in sync so the header label stays
        // accurate when the peer disconnects mid-chat.
        setConv((prev) =>
          prev && prev.other.user_id === evt.user_id
            ? {
                ...prev,
                other: {
                  ...prev.other,
                  online: evt.online,
                  last_seen_at: evt.last_seen_at ?? prev.other.last_seen_at,
                },
              }
            : prev,
        );
      }
    });
  }, [subscribe, conversationId, me]);

  const otherOnline = useMemo(() => {
    if (!conv) return false;
    return online.has(conv.other.user_id) || conv.other.online;
  }, [conv, online]);

  // Re-render the header every 30s so the "5 мин назад" label stays fresh
  // without needing a full conversation refetch.
  useTicker(30_000);

  if (!conv) {
    return <p className="text-ink-200/60">Грузим…</p>;
  }

  return (
    <main className="flex h-[calc(100dvh-1.5rem)] flex-col">
      <header className="sticky top-0 z-10 -mx-4 mb-2 flex items-center gap-3 border-b border-white/5 bg-ink-950/85 px-4 py-3 backdrop-blur">
        <Link href="/chats" className="btn-ghost h-10 w-10 justify-center px-0">
          ←
        </Link>
        <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-ink-700/60">
          {conv.other.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(conv.other.avatar.user_id, conv.other.avatar.filename)}
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
            {conv.other.name}
            {conv.other.age ? `, ${conv.other.age}` : ""}
          </div>
          <div className="text-[11px] text-ink-200/60">
            {presenceLabel({
              typing: otherTyping,
              online: otherOnline,
              lastSeenAt: conv.other.last_seen_at,
            })}
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto pb-2"
      >
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            isMine={m.from_user_id === me?.user_id}
            onReply={() => setReply(m)}
            onReact={(emoji) => {
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

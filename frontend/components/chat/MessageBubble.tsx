"use client";

import { memo, useState } from "react";

import type { ChatMessage } from "@/lib/types";
import { mediaUrl } from "@/lib/media";
import { VideoNote } from "./VideoNote";
import { VoicePlayer } from "./VoicePlayer";

const REACTIONS = ["❤️", "😂", "🔥", "😍", "😮", "😢"];

type MessageBubbleProps = {
  msg: ChatMessage;
  isMine: boolean;
  onReply: (id: number) => void;
  onReact: (id: number, emoji: string) => void;
  onDelete: (id: number) => void;
  showRead: boolean;
};

function MessageBubbleImpl({
  msg,
  isMine,
  onReply,
  onReact,
  onDelete,
  showRead,
}: MessageBubbleProps) {
  const [picker, setPicker] = useState(false);
  if (msg.deleted_at) {
    return (
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm italic text-ink-200/50 ${
          isMine ? "self-end bg-white/5" : "self-start bg-white/5"
        }`}
      >
        сообщение удалено
      </div>
    );
  }

  // Round video notes render as a chrome-less circle, no bubble bg.
  const isVideoNote = msg.kind === "video" && !!msg.attachment;

  return (
    <div
      className={`group relative flex max-w-[85%] flex-col gap-1 ${
        isMine ? "self-end items-end" : "self-start items-start"
      }`}
    >
      {isVideoNote && msg.attachment ? (
        <div className="relative">
          <VideoNote
            src={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
          />
        </div>
      ) : (
        <div
          className={`relative rounded-2xl text-[15px] shadow-sm ${
            msg.kind === "photo" ? "" : "px-3 py-2"
          } ${
            isMine
              ? "bg-ember-500/85 text-ink-950"
              : "bg-white/10 text-ink-50 backdrop-blur"
          } ${msg.kind === "voice" ? "px-3 py-2 sm:px-4" : ""}`}
        >
          {msg.kind === "text" ? (
            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
          ) : msg.kind === "photo" && msg.attachment ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
              alt=""
              className="max-h-80 rounded-2xl"
            />
          ) : msg.kind === "voice" && msg.attachment ? (
            <VoicePlayer
              src={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
              durationMs={msg.attachment.duration_ms}
              isMine={isMine}
            />
          ) : msg.kind === "file" && msg.attachment ? (
            <a
              href={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              📎 {msg.attachment.filename}
            </a>
          ) : null}
        </div>
      )}

      {msg.reactions.length > 0 && (
        <div className="flex gap-1">
          {Object.entries(
            msg.reactions.reduce<Record<string, number>>((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
              return acc;
            }, {}),
          ).map(([emoji, n]) => (
            <span
              key={emoji}
              className="rounded-full bg-white/10 px-2 py-0.5 text-xs"
            >
              {emoji} {n > 1 ? n : ""}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-[10px] text-ink-200/50">
        <span>{new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
        {isMine && showRead && msg.read_by.length > 0 && <span>· прочитано</span>}
      </div>

      <div className="absolute -top-2 right-0 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          aria-label="Реакция"
          className="rounded-full bg-ink-900/80 px-2 py-1 text-xs"
          onClick={() => setPicker((v) => !v)}
        >
          😊
        </button>
        <button
          type="button"
          aria-label="Ответить"
          className="rounded-full bg-ink-900/80 px-2 py-1 text-xs"
          onClick={() => onReply(msg.id)}
        >
          ↩
        </button>
        {isMine && (
          <button
            type="button"
            aria-label="Удалить"
            className="rounded-full bg-ink-900/80 px-2 py-1 text-xs text-rose-300"
            onClick={() => onDelete(msg.id)}
          >
            ✕
          </button>
        )}
      </div>

      {picker && (
        <div className="absolute -top-10 right-0 flex gap-1 rounded-full bg-ink-900/95 px-2 py-1 shadow-xl">
          {REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onReact(msg.id, e);
                setPicker(false);
              }}
              className="text-lg hover:scale-125 transition"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Wrap in React.memo so re-rendering the message list (e.g. on every
// WS event or scroll-position change) only re-paints bubbles whose
// inputs actually changed. Custom comparator keeps the diff cheap.
export const MessageBubble = memo(MessageBubbleImpl, (a, b) => {
  if (a.isMine !== b.isMine) return false;
  if (a.showRead !== b.showRead) return false;
  if (a.onReply !== b.onReply) return false;
  if (a.onReact !== b.onReact) return false;
  if (a.onDelete !== b.onDelete) return false;
  if (a.msg === b.msg) return true;
  const m1 = a.msg;
  const m2 = b.msg;
  return (
    m1.id === m2.id &&
    m1.body === m2.body &&
    m1.deleted_at === m2.deleted_at &&
    m1.reactions.length === m2.reactions.length &&
    m1.read_by.length === m2.read_by.length &&
    m1.reactions.every(
      (r, i) =>
        r.user_id === m2.reactions[i]?.user_id &&
        r.emoji === m2.reactions[i]?.emoji,
    )
  );
});

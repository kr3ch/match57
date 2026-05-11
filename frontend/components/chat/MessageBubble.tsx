"use client";

import { useState } from "react";

import type { ChatMessage } from "@/lib/types";
import { mediaUrl } from "@/lib/media";

const REACTIONS = ["❤️", "😂", "🔥", "😍", "😮", "😢"];

export function MessageBubble({
  msg,
  isMine,
  onReply,
  onReact,
  onDelete,
  onForward,
  showRead,
  actionsOpen,
  onToggleActions,
}: {
  msg: ChatMessage;
  isMine: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete: () => void;
  onForward: () => void;
  showRead: boolean;
  actionsOpen: boolean;
  onToggleActions: () => void;
}) {
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

  return (
    <div
      className={`group relative flex max-w-[85%] flex-col gap-1 ${
        isMine ? "self-end items-end" : "self-start items-start"
      }`}
    >
      <div
        className={`relative rounded-2xl px-3 py-2 text-[15px] shadow-sm cursor-pointer select-none ${
          isMine
            ? "bg-ember-500/85 text-ink-950"
            : "bg-white/10 text-ink-50 backdrop-blur"
        }`}
        onClick={onToggleActions}
      >
        {msg.kind === "text" ? (
          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        ) : msg.kind === "photo" && msg.attachment ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
            alt=""
            className="max-h-80 rounded-xl"
          />
        ) : msg.kind === "video" && msg.attachment ? (
          <video
            src={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
            controls
            className="max-h-80 rounded-xl"
          />
        ) : msg.kind === "voice" && msg.attachment ? (
          <audio
            src={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
            controls
            className="max-w-full"
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

      {actionsOpen && (
        <div className={`absolute -top-2 z-20 flex gap-1 ${isMine ? "right-0" : "left-0"}`}>
          <button
            type="button"
            aria-label="Реакция"
            className="rounded-full bg-ink-900/90 px-2 py-1 text-xs backdrop-blur"
            onClick={(e) => { e.stopPropagation(); setPicker((v) => !v); }}
          >
            😊
          </button>
          <button
            type="button"
            aria-label="Ответить"
            className="rounded-full bg-ink-900/90 px-2 py-1 text-xs backdrop-blur"
            onClick={(e) => { e.stopPropagation(); onReply(); }}
          >
            ↩
          </button>
          <button
            type="button"
            aria-label="Переслать"
            className="rounded-full bg-ink-900/90 px-2 py-1 text-xs backdrop-blur"
            onClick={(e) => { e.stopPropagation(); onForward(); }}
          >
            ↗
          </button>
          {isMine && (
            <button
              type="button"
              aria-label="Удалить"
              className="rounded-full bg-ink-900/90 px-2 py-1 text-xs text-rose-300 backdrop-blur"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {picker && (
        <div className={`absolute -top-10 z-30 flex gap-1 rounded-full bg-ink-900/95 px-2 py-1 shadow-xl ${isMine ? "right-0" : "left-0"}`}>
          {REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onReact(e);
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

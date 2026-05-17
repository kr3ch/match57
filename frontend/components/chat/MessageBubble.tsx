"use client";

import { useEffect, useState } from "react";

import type { ChatMessage } from "@/lib/types";
import { mediaUrl } from "@/lib/media";
import { PhotoLightbox } from "@/components/chat/PhotoLightbox";
import { VideoBubble } from "@/components/chat/VideoBubble";
import { VoiceBubble } from "@/components/chat/VoiceBubble";

/** True if a chat file attachment is actually a still / animated image we
 * want to inline-render instead of showing as a download link (e.g. .gif). */
function isImageMime(mime: string | undefined | null): boolean {
  return !!mime && mime.toLowerCase().startsWith("image/");
}

function prettyBytes(n: number | undefined | null): string | null {
  if (!n || n <= 0) return null;
  const units = ["б", "КБ", "МБ", "ГБ"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

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
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Close the lightbox if the message is removed (e.g. unsent) while open.
  useEffect(() => {
    if (msg.deleted_at) setLightboxOpen(false);
  }, [msg.deleted_at]);

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
        className={`relative rounded-2xl text-[15px] cursor-pointer select-none ${
          // Photo and video have no padding / background — the media
          // itself is the bubble (with its own rounded corners + shadow).
          // Text, voice and file still get the colored card.
          msg.kind === "video" || msg.kind === "photo"
            ? "bg-transparent p-0 shadow-none"
            : `px-3 py-2 shadow-sm ${
                isMine
                  ? "bg-ember-500/85 text-ink-950"
                  : "bg-white/10 text-ink-50 backdrop-blur"
              }`
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
            className="block max-h-80 w-auto cursor-zoom-in rounded-2xl object-cover shadow-card ring-1 ring-white/10 transition hover:brightness-105"
            style={{ maxWidth: "min(320px, 70vw)" }}
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(true);
            }}
          />
        ) : msg.kind === "video" && msg.attachment ? (
          <VideoBubble
            src={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
            isMine={isMine}
          />
        ) : msg.kind === "voice" && msg.attachment ? (
          <VoiceBubble
            src={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
            isMine={isMine}
            durationMs={msg.attachment.duration_ms}
          />
        ) : msg.kind === "file" && msg.attachment ? (
          isImageMime(msg.attachment.mime) ? (
            // GIFs and other oddball image mimes that we still treat as
            // generic "file" server-side. Render inline so animation plays.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
              alt=""
              className="block max-h-80 w-auto cursor-zoom-in rounded-2xl object-contain shadow-card ring-1 ring-white/10 transition hover:brightness-105"
              style={{ maxWidth: "min(320px, 70vw)" }}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
            />
          ) : (
            <a
              href={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
              target="_blank"
              rel="noreferrer"
              download={msg.attachment.filename}
              className="flex items-center gap-3 rounded-xl bg-black/10 px-2.5 py-1.5 hover:bg-black/20"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/15 text-base">
                📎
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {msg.attachment.filename}
                </span>
                {(() => {
                  const sz = prettyBytes((msg.attachment as { size?: number }).size);
                  return (
                    <span className="block text-[11px] opacity-70">
                      {sz ? `файл • ${sz}` : "скачать"}
                    </span>
                  );
                })()}
              </span>
            </a>
          )
        ) : null}
      </div>
      {lightboxOpen && msg.attachment && (
        <PhotoLightbox
          src={mediaUrl(msg.attachment.user_id, msg.attachment.filename)}
          onClose={() => setLightboxOpen(false)}
        />
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

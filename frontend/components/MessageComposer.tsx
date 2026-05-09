"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/components/Toaster";

type Kind = "text" | "photo" | "video" | "voice" | "video_note";

export function MessageComposer({
  targetUserId,
  onSent,
}: {
  targetUserId: number;
  onSent: (result: { match: boolean; contact: string | null }) => void;
}) {
  const [kind, setKind] = useState<Kind>("text");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function send() {
    setBusy(true);
    try {
      const file = kind !== "text" ? fileRef.current?.files?.[0] : undefined;
      if (kind !== "text" && !file) {
        toast({ title: "Прикрепи файл", tone: "error" });
        return;
      }
      const r = await api.sendMessage({
        target_user_id: targetUserId,
        kind,
        text: kind === "text" ? text : undefined,
        file,
      });
      onSent({ match: r.match, contact: r.contact });
      toast(
        r.match
          ? {
              title: "Взаимная симпатия!",
              body: r.contact ?? "Контакт отправлен в Telegram.",
              tone: "match",
            }
          : { title: "Сообщение отправлено", body: "Уведомление в Telegram." },
      );
      setText("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast({ title: "Не удалось отправить", body: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const KINDS: { id: Kind; label: string }[] = [
    { id: "text", label: "Текст" },
    { id: "photo", label: "Фото" },
    { id: "video", label: "Видео" },
    { id: "voice", label: "Голос" },
    { id: "video_note", label: "Кружок" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              kind === k.id
                ? "border-ember-400/60 bg-ember-500/15 text-ember-100"
                : "border-white/10 bg-white/[0.03] text-ink-100"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === "text" ? (
        <textarea
          className="input min-h-32"
          placeholder="Что хочешь написать?"
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      ) : (
        <input
          ref={fileRef}
          type="file"
          accept={
            kind === "photo"
              ? "image/*"
              : kind === "video" || kind === "video_note"
                ? "video/*"
                : "audio/*"
          }
          className="input file:mr-3 file:rounded-full file:border-0 file:bg-ember-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink-950"
        />
      )}

      <button
        type="button"
        onClick={send}
        disabled={busy || (kind === "text" && !text.trim())}
        className="btn-primary disabled:opacity-50"
      >
        {busy ? "Отправляем…" : "Отправить и поставить лайк"}
      </button>
      <p className="text-xs text-ink-200/60">
        Сообщение приходит получателю в Telegram. Если он лайкнул в ответ —
        сразу мэтч и контакт.
      </p>
    </div>
  );
}

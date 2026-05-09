"use client";

import { useEffect, useRef, useState } from "react";

import { APIError, api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";

export function Composer({
  conversationId,
  replyTo,
  onSent,
  onClearReply,
}: {
  conversationId: number;
  replyTo: ChatMessage | null;
  onSent: (m: ChatMessage) => void;
  onClearReply: () => void;
}) {
  const { push } = useNotifications();
  const { send } = useRealtime();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const recStartRef = useRef<number>(0);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recVideoRef = useRef<HTMLVideoElement | null>(null);

  // Typing presence — fire { type: "typing", is_typing: true } on each
  // keystroke, then stop after 2s of inactivity.
  const typingTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);
  const onTyping = () => {
    send({ type: "typing", conversation_id: conversationId, is_typing: true });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      send({ type: "typing", conversation_id: conversationId, is_typing: false });
    }, 2000);
  };

  async function sendText() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const r = await api.sendText(conversationId, body, replyTo?.id);
      onSent(r.message);
      setText("");
      onClearReply();
    } catch (e) {
      if (e instanceof APIError) push({ title: "Не отправлено", body: e.detail });
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndSend(blob: Blob, kind: "voice" | "video" | "photo" | "file", durationMs?: number) {
    setBusy(true);
    try {
      const file = blob instanceof File ? blob : new File([blob], `upload-${Date.now()}.${kind === "voice" ? "webm" : kind === "video" ? "webm" : "bin"}`, { type: blob.type });
      const meta = await api.upload(file);
      const r = await api.sendAttachment({
        conversation_id: conversationId,
        kind,
        filename: meta.filename,
        mime: meta.mime,
        duration_ms: durationMs ?? meta.duration_ms ?? undefined,
        width: meta.width ?? undefined,
        height: meta.height ?? undefined,
        reply_to_id: replyTo?.id,
      });
      onSent(r.message);
      onClearReply();
    } catch (e) {
      if (e instanceof APIError) push({ title: "Не отправлено", body: e.detail });
    } finally {
      setBusy(false);
    }
  }

  async function startAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recRef.current = rec;
      recChunksRef.current = [];
      recStartRef.current = Date.now();
      rec.ondataavailable = (e) => recChunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
        const dur = Date.now() - recStartRef.current;
        stream.getTracks().forEach((t) => t.stop());
        await uploadAndSend(blob, "voice", dur);
      };
      rec.start();
      setRecordingAudio(true);
    } catch (e) {
      push({ title: "Нет доступа к микрофону", body: (e as Error).message });
    }
  }

  function stopAudio() {
    recRef.current?.stop();
    setRecordingAudio(false);
  }

  async function startVideo() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (recVideoRef.current) {
        recVideoRef.current.srcObject = stream;
        recVideoRef.current.play().catch(() => {});
      }
      const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
      recRef.current = rec;
      recChunksRef.current = [];
      recStartRef.current = Date.now();
      rec.ondataavailable = (e) => recChunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(recChunksRef.current, { type: "video/webm" });
        const dur = Date.now() - recStartRef.current;
        stream.getTracks().forEach((t) => t.stop());
        if (recVideoRef.current) recVideoRef.current.srcObject = null;
        await uploadAndSend(blob, "video", dur);
      };
      rec.start();
      setRecordingVideo(true);
    } catch (e) {
      push({ title: "Нет доступа к камере", body: (e as Error).message });
    }
  }

  function stopVideo() {
    recRef.current?.stop();
    setRecordingVideo(false);
  }

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/5 bg-ink-950/85 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1 text-xs">
          <span className="text-ink-200/70">↩ ответ на:</span>
          <span className="line-clamp-1 flex-1">{replyTo.body || replyTo.kind}</span>
          <button onClick={onClearReply} className="text-ink-200/60">✕</button>
        </div>
      )}

      {recordingVideo && (
        <video
          ref={recVideoRef}
          muted
          playsInline
          className="mb-2 h-32 w-32 rounded-xl bg-black"
        />
      )}

      <div className="flex items-end gap-2">
        <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-white/5 text-xl">
          📎
          <input
            type="file"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const isImg = f.type.startsWith("image/");
              const isVid = f.type.startsWith("video/");
              await uploadAndSend(f, isImg ? "photo" : isVid ? "video" : "file");
              e.target.value = "";
            }}
          />
        </label>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendText();
            }
          }}
          rows={1}
          placeholder="Сообщение…"
          className="input min-h-11 flex-1 resize-none py-2.5"
        />

        {text.trim() ? (
          <button
            type="button"
            onClick={() => void sendText()}
            disabled={busy}
            className="btn-primary h-11 px-4"
          >
            ➤
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => (recordingAudio ? stopAudio() : startAudio())}
              disabled={busy || recordingVideo}
              className={`h-11 w-11 rounded-xl text-xl ${recordingAudio ? "bg-rose-500/80" : "bg-white/5"}`}
              aria-label="Голосовое"
            >
              🎙
            </button>
            <button
              type="button"
              onClick={() => (recordingVideo ? stopVideo() : startVideo())}
              disabled={busy || recordingAudio}
              className={`h-11 w-11 rounded-xl text-xl ${recordingVideo ? "bg-rose-500/80" : "bg-white/5"}`}
              aria-label="Видео"
            >
              📹
            </button>
          </>
        )}
      </div>
    </div>
  );
}

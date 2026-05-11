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
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const recStartRef = useRef<number>(0);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recVideoRef = useRef<HTMLVideoElement | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  // Tick recording timer at 4 Hz while recording is active.
  useEffect(() => {
    if (!recordingAudio && !recordingVideo) {
      setElapsed(0);
      return;
    }
    const id = window.setInterval(
      () => setElapsed(Date.now() - recStartRef.current),
      250,
    );
    return () => window.clearInterval(id);
  }, [recordingAudio, recordingVideo]);

  // The <video> preview element only mounts once recordingVideo flips
  // to true, so we cannot bind srcObject in startVideo directly. Bind
  // it once the element exists.
  useEffect(() => {
    if (recVideoRef.current && videoStream) {
      recVideoRef.current.srcObject = videoStream;
      recVideoRef.current.play().catch(() => {});
    }
  }, [videoStream]);

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
        setVideoStream(null);
        await uploadAndSend(blob, "video", dur);
      };
      rec.start();
      setVideoStream(stream);
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
    <div className="sticky bottom-0 z-20 border-t border-white/5 bg-ink-950/85 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur sm:px-4 sm:pt-3">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-xs">
          <span className="h-3 w-[2px] rounded-full bg-ember-400" />
          <span className="text-ink-200/60">Ответ:</span>
          <span className="line-clamp-1 flex-1 text-ink-100/90">
            {replyTo.body || replyTo.kind}
          </span>
          <button
            onClick={onClearReply}
            className="text-ink-200/60 transition hover:text-ink-50"
            aria-label="Отменить ответ"
          >
            ✕
          </button>
        </div>
      )}

      {recordingVideo && (
        <div className="mb-3 flex justify-center">
          <div className="relative">
            <video
              ref={recVideoRef}
              muted
              playsInline
              className="h-44 w-44 rounded-full bg-black object-cover shadow-card ring-2 ring-rose-500/60 sm:h-52 sm:w-52"
            />
            <span className="absolute left-1/2 top-2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-rose-500/95 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Rec
            </span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink-950/70 px-2 py-0.5 text-[10px] tabular-nums text-white backdrop-blur">
              {fmtElapsed(elapsed)}
            </span>
          </div>
        </div>
      )}

      {recordingAudio && (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-400" />
          </span>
          <span className="flex-1">Запись голосового</span>
          <span className="tabular-nums text-rose-100/80">{fmtElapsed(elapsed)}</span>
        </div>
      )}

      {busy && !recordingAudio && !recordingVideo && (
        <div className="mb-2 flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-xs text-ink-200/70">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white/80" />
          Отправляется…
        </div>
      )}

      <div className="flex items-end gap-2">
        <label
          className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-2xl bg-white/5 text-ink-100 transition hover:bg-white/10 active:scale-95"
          aria-label="Прикрепить файл"
        >
          <IconPaperclip />
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
            aria-label="Отправить"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-ember-500 text-ink-950 shadow-card transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            <IconSend />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => (recordingAudio ? stopAudio() : startAudio())}
              disabled={busy || recordingVideo}
              aria-label={recordingAudio ? "Остановить запись" : "Голосовое сообщение"}
              className={`flex h-11 w-11 flex-none items-center justify-center rounded-2xl transition active:scale-95 ${
                recordingAudio
                  ? "bg-rose-500 text-white shadow-card"
                  : "bg-white/5 text-ink-100 hover:bg-white/10"
              }`}
            >
              {recordingAudio ? <IconStop /> : <IconMic />}
            </button>
            <button
              type="button"
              onClick={() => (recordingVideo ? stopVideo() : startVideo())}
              disabled={busy || recordingAudio}
              aria-label={recordingVideo ? "Остановить запись" : "Видеосообщение"}
              className={`flex h-11 w-11 flex-none items-center justify-center rounded-2xl transition active:scale-95 ${
                recordingVideo
                  ? "bg-rose-500 text-white shadow-card"
                  : "bg-white/5 text-ink-100 hover:bg-white/10"
              }`}
            >
              {recordingVideo ? <IconStop /> : <IconVideo />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function IconPaperclip() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15.5 8.5-6.2 6.2a3 3 0 0 1-4.3-4.2l7.6-7.6a2 2 0 0 1 2.8 2.8L7.8 13.4a1 1 0 0 1-1.4-1.4l6.4-6.4" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
      <path d="M2.5 9.2 17.3 3a.7.7 0 0 1 .9.9l-6.2 14.8a.7.7 0 0 1-1.3 0l-2.4-5.9-5.9-2.4a.7.7 0 0 1 0-1.3z" />
    </svg>
  );
}
function IconMic() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" />
      <path d="M5 9.5a5 5 0 0 0 10 0" />
      <path d="M10 14.5v3" />
    </svg>
  );
}
function IconVideo() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="11" height="10" rx="2.5" />
      <path d="m13.5 9.5 4-2.5v6l-4-2.5z" />
    </svg>
  );
}
function IconStop() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
      <rect x="5" y="5" width="10" height="10" rx="1.5" />
    </svg>
  );
}

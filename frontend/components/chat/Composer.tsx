"use client";

import { useEffect, useRef, useState } from "react";

import { APIError, api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";

type RecordingKind = "voice" | "video";
type RecState = "idle" | "recording" | "paused";

function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

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

  // Recording state.
  const [recKind, setRecKind] = useState<RecordingKind | null>(null);
  const [recState, setRecState] = useState<RecState>("idle");
  const [recElapsedMs, setRecElapsedMs] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recStartRef = useRef<number>(0);
  const recAccumMsRef = useRef<number>(0);
  const recCancelledRef = useRef(false);
  const recTickRef = useRef<number | null>(null);
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

  // Attach the live MediaStream to the <video> preview element. The element
  // is always mounted while recording video, but stream attachment has to be
  // an effect because `srcObject` is set on a *mounted* element.
  useEffect(() => {
    if (recKind !== "video") return;
    const el = recVideoRef.current;
    const stream = recStreamRef.current;
    if (el && stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [recKind, recState]);

  // Tick duration counter while recording. Pause stops ticking but keeps
  // the accumulated duration.
  useEffect(() => {
    if (recState !== "recording") return;
    recTickRef.current = window.setInterval(() => {
      setRecElapsedMs(recAccumMsRef.current + (Date.now() - recStartRef.current));
    }, 200);
    return () => {
      if (recTickRef.current) clearInterval(recTickRef.current);
      recTickRef.current = null;
    };
  }, [recState]);

  // Clean up media tracks on unmount (covers swiping back from a chat
  // mid-recording — never leak the camera light).
  useEffect(() => {
    return () => {
      recStreamRef.current?.getTracks().forEach((t) => t.stop());
      recStreamRef.current = null;
    };
  }, []);

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

  function resetRecorderState() {
    recRef.current = null;
    recChunksRef.current = [];
    recStreamRef.current?.getTracks().forEach((t) => t.stop());
    recStreamRef.current = null;
    recCancelledRef.current = false;
    recAccumMsRef.current = 0;
    setRecKind(null);
    setRecState("idle");
    setRecElapsedMs(0);
  }

  async function startRecording(kind: RecordingKind) {
    if (recRef.current) return;
    try {
      const constraints: MediaStreamConstraints =
        kind === "voice"
          ? { audio: true }
          : { video: { facingMode: "user" }, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      recStreamRef.current = stream;
      const mimeType = kind === "voice" ? "audio/webm" : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType });
      recRef.current = rec;
      recChunksRef.current = [];
      recCancelledRef.current = false;
      recAccumMsRef.current = 0;
      recStartRef.current = Date.now();

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const cancelled = recCancelledRef.current;
        const chunks = recChunksRef.current;
        const stream = recStreamRef.current;
        const accumulated = recAccumMsRef.current;
        // Capture state and reset UI before the upload kicks off so the
        // camera light goes out immediately.
        resetRecorderState();
        if (cancelled || chunks.length === 0) {
          // Drop the recording silently.
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        const blob = new Blob(chunks, { type: mimeType });
        await uploadAndSend(blob, kind, accumulated);
      };

      // 200ms timeslice so we always have at least one chunk by stop-time,
      // even for very short recordings.
      rec.start(200);
      setRecKind(kind);
      setRecState("recording");
      setRecElapsedMs(0);
    } catch (e) {
      push({
        title: kind === "voice" ? "Нет доступа к микрофону" : "Нет доступа к камере",
        body: (e as Error).message,
      });
      resetRecorderState();
    }
  }

  function pauseRecording() {
    const rec = recRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    recAccumMsRef.current += Date.now() - recStartRef.current;
    setRecState("paused");
  }

  function resumeRecording() {
    const rec = recRef.current;
    if (!rec || rec.state !== "paused") return;
    rec.resume();
    recStartRef.current = Date.now();
    setRecState("recording");
  }

  function stopAndSend() {
    const rec = recRef.current;
    if (!rec) return;
    // Capture final elapsed before stop fires (which resets state).
    if (rec.state === "recording") {
      recAccumMsRef.current += Date.now() - recStartRef.current;
    }
    recCancelledRef.current = false;
    try {
      rec.stop();
    } catch {
      resetRecorderState();
    }
  }

  function cancelRecording() {
    const rec = recRef.current;
    recCancelledRef.current = true;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        resetRecorderState();
      }
    } else {
      resetRecorderState();
    }
  }

  const isRecording = recKind !== null;
  const elapsedLabel = fmtDuration(recElapsedMs);

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/5 bg-ink-950/85 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
      {replyTo && !isRecording && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1 text-xs">
          <span className="text-ink-200/70">↩ ответ на:</span>
          <span className="line-clamp-1 flex-1">{replyTo.body || replyTo.kind}</span>
          <button onClick={onClearReply} className="text-ink-200/60">✕</button>
        </div>
      )}

      {isRecording && (
        <div className="mb-2 flex flex-col gap-2 rounded-2xl bg-white/5 p-2">
          <div className="flex items-center gap-3">
            {recKind === "video" ? (
              <video
                ref={recVideoRef}
                muted
                playsInline
                autoPlay
                className="h-24 w-24 flex-none rounded-xl bg-black object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 flex-none items-center justify-center rounded-xl bg-black/40 text-3xl">
                🎙
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    recState === "recording" ? "animate-pulse bg-rose-500" : "bg-amber-400"
                  }`}
                  aria-hidden
                />
                <span className="font-medium">
                  {recState === "recording"
                    ? recKind === "voice"
                      ? "Запись голоса"
                      : "Запись видео"
                    : "Пауза"}
                </span>
                <span className="ml-auto tabular-nums text-ink-200/80">{elapsedLabel}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recState === "recording" ? (
                  <button
                    type="button"
                    onClick={pauseRecording}
                    className="h-9 rounded-lg bg-white/10 px-3 text-xs"
                  >
                    ❚❚ Пауза
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeRecording}
                    className="h-9 rounded-lg bg-white/10 px-3 text-xs"
                  >
                    ▶ Продолжить
                  </button>
                )}
                <button
                  type="button"
                  onClick={stopAndSend}
                  disabled={busy}
                  className="h-9 rounded-lg bg-emerald-500/85 px-3 text-xs text-ink-950"
                >
                  ⏹ Отправить
                </button>
                <button
                  type="button"
                  onClick={cancelRecording}
                  disabled={busy}
                  className="h-9 rounded-lg bg-rose-500/20 px-3 text-xs text-rose-200"
                >
                  ✕ Отменить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-white/5 text-xl">
          📎
          <input
            type="file"
            className="hidden"
            disabled={isRecording}
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
          disabled={isRecording}
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
          placeholder={isRecording ? "Идёт запись…" : "Сообщение…"}
          className="input min-h-11 flex-1 resize-none py-2.5 disabled:opacity-50"
        />

        {text.trim() && !isRecording ? (
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
              onClick={() => (recKind === "voice" ? cancelRecording() : startRecording("voice"))}
              disabled={busy || recKind === "video"}
              className={`h-11 w-11 rounded-xl text-xl ${recKind === "voice" ? "bg-rose-500/80" : "bg-white/5"}`}
              aria-label="Голосовое"
            >
              🎙
            </button>
            <button
              type="button"
              onClick={() => (recKind === "video" ? cancelRecording() : startRecording("video"))}
              disabled={busy || recKind === "voice"}
              className={`h-11 w-11 rounded-xl text-xl ${recKind === "video" ? "bg-rose-500/80" : "bg-white/5"}`}
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

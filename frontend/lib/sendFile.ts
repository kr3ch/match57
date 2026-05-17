/**
 * Pick a chat-attachment ``kind`` from a File's MIME / filename. Used by
 * both the Composer's paperclip path and the chat page's drag-and-drop
 * handler, so both end up classifying the same file the same way.
 *
 * Some browsers (iOS Safari for .mov, Android for some .m4v) hand us a
 * File with empty ``type``, so we also fall back to the filename
 * extension before defaulting to "file".
 */
export type AttachmentKind = "photo" | "video" | "voice" | "file";

// Animated images don't fit the "photo" bubble (which goes through a JPEG
// resize on the server and loses animation). Route GIFs through the
// generic "file" kind — the chat bubble renders them inline anyway when
// the mime starts with image/.
const STILL_IMG_RE = /\.(jpe?g|png|webp)$/i;
const VID_RE = /\.(mp4|webm|mov|m4v|3gp)$/i;
const AUD_RE = /\.(mp3|m4a|aac|wav|ogg)$/i;

export function classifyFile(f: File): AttachmentKind {
  const name = f.name.toLowerCase();
  const mime = f.type.toLowerCase();
  if (mime === "image/gif" || name.endsWith(".gif")) return "file";
  if (mime.startsWith("image/") || STILL_IMG_RE.test(name)) return "photo";
  if (mime.startsWith("video/") || VID_RE.test(name)) return "video";
  if (mime.startsWith("audio/") || AUD_RE.test(name)) return "voice";
  return "file";
}

import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

export async function uploadAndSendFile(opts: {
  conversationId: number;
  file: File;
  replyToId?: number;
  kind?: AttachmentKind;
}): Promise<ChatMessage> {
  const { conversationId, file, replyToId, kind } = opts;
  const meta = await api.upload(file);
  // Prefer the backend's classification — it has the canonical MIME after
  // normalization (e.g. iPhone .mov reported as octet-stream becomes
  // video/quicktime). Fall back to client-side classifyFile if the server
  // didn't return a kind for any reason.
  const finalKind: AttachmentKind =
    kind ?? (meta.kind as AttachmentKind) ?? classifyFile(file);
  const r = await api.sendAttachment({
    conversation_id: conversationId,
    kind: finalKind,
    filename: meta.filename,
    mime: meta.mime,
    duration_ms: meta.duration_ms ?? undefined,
    width: meta.width ?? undefined,
    height: meta.height ?? undefined,
    reply_to_id: replyToId,
  });
  return r.message;
}

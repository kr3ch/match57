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

const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;
const VID_RE = /\.(mp4|webm|mov|m4v|3gp)$/i;
const AUD_RE = /\.(mp3|m4a|aac|wav|ogg)$/i;

export function classifyFile(f: File): AttachmentKind {
  const name = f.name.toLowerCase();
  if (f.type.startsWith("image/") || IMG_RE.test(name)) return "photo";
  if (f.type.startsWith("video/") || VID_RE.test(name)) return "video";
  if (f.type.startsWith("audio/") || AUD_RE.test(name)) return "voice";
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
  const r = await api.sendAttachment({
    conversation_id: conversationId,
    kind: kind ?? classifyFile(file),
    filename: meta.filename,
    mime: meta.mime,
    duration_ms: meta.duration_ms ?? undefined,
    width: meta.width ?? undefined,
    height: meta.height ?? undefined,
    reply_to_id: replyToId,
  });
  return r.message;
}

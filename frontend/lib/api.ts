/**
 * Typed fetch client. Backend is mounted on the same origin via the Next.js
 * rewrite (``next.config.js``); on dev that proxy hits ``localhost:8000``.
 * All requests carry the auth cookie (``credentials: include``).
 */
import type {
  AdminStatsV2,
  ChatMessage,
  ConversationListItem,
  Gender,
  IncomingLike,
  LikeResult,
  LookingFor,
  Match,
  Me,
  PublicProfile,
  ReportRow,
  SkippedItem,
} from "./types";

const BASE = "https://match57.onrender.com/";

export class APIError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail =
        typeof body.detail === "string"
          ? body.detail
          : body.message || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new APIError(res.status, detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new APIError(res.status, detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export type RegisterPayload = {
  email: string;
  password: string;
  username?: string;
  name: string;
  age: number;
  gender: Gender;
  looking_for: LookingFor;
  description?: string;
  school?: string;
  phone?: string;
  ref?: number;
};

export const api = {
  // ── auth ─────────────────────────────────────────────────────────
  register(payload: RegisterPayload) {
    return request<{ ok: true; user: Me }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(email: string, password: string) {
    return request<{ ok: true; user: Me }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  logout() {
    return request<{ ok: true }>("/api/auth/logout", { method: "POST" });
  },
  me() {
    return request<{ user: Me }>("/api/auth/me");
  },
  resendVerify() {
    return request<{ ok: true }>("/api/auth/resend-verify", { method: "POST" });
  },
  verifyEmail(token: string) {
    return request<{ ok: true }>(
      `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      { method: "POST" },
    );
  },

  // ── profile ──────────────────────────────────────────────────────
  myProfile() {
    return request<{ profile: Me }>("/api/profile");
  },
  updateProfile(patch: Partial<RegisterPayload> & { hidden?: boolean }) {
    return request<{ profile: Me }>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  addPhoto(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    return requestForm<{ profile: Me }>("/api/profile/photos", fd);
  },
  deletePhoto(photoId: number) {
    return request<{ profile: Me }>(`/api/profile/photos/${photoId}`, {
      method: "DELETE",
    });
  },

  // ── browse ───────────────────────────────────────────────────────
  browse(opts: { cursor?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (opts.cursor) q.set("cursor", String(opts.cursor));
    if (opts.limit) q.set("limit", String(opts.limit));
    return request<{
      items: PublicProfile[];
      total: number;
      next: number | null;
    }>(`/api/browse${q.toString() ? `?${q}` : ""}`);
  },
  viewUser(userId: number) {
    return request<{ profile: PublicProfile }>(`/api/browse/${userId}`);
  },

  // ── likes / matches ──────────────────────────────────────────────
  like(targetId: number) {
    return request<LikeResult>("/api/likes", {
      method: "POST",
      body: JSON.stringify({ target_id: targetId }),
    });
  },
  dislike(targetId: number) {
    return request<{ ok: true }>("/api/dislikes", {
      method: "POST",
      body: JSON.stringify({ target_id: targetId }),
    });
  },
  matches() {
    return request<{ items: Match[] }>("/api/matches");
  },
  incomingLikes() {
    return request<{ items: IncomingLike[] }>("/api/likes/incoming");
  },
  skipped() {
    return request<{ items: SkippedItem[] }>("/api/skipped");
  },
  undoSkip(targetId: number) {
    return request<{ ok: true }>("/api/skipped/undo", {
      method: "POST",
      body: JSON.stringify({ target_id: targetId }),
    });
  },

  // ── conversations / messages ─────────────────────────────────────
  conversations() {
    return request<{ items: ConversationListItem[] }>("/api/conversations");
  },
  conversation(id: number) {
    return request<{ conversation: ConversationListItem }>(
      `/api/conversations/${id}`,
    );
  },
  history(id: number, opts: { offset?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (opts.offset) q.set("offset", String(opts.offset));
    if (opts.limit) q.set("limit", String(opts.limit));
    return request<{ items: ChatMessage[]; next: number | null }>(
      `/api/conversations/${id}/messages${q.toString() ? `?${q}` : ""}`,
    );
  },
  markRead(id: number) {
    return request<{ ok: true; marked: number }>(
      `/api/conversations/${id}/read`,
      { method: "POST" },
    );
  },
  conversationWith(userId: number) {
    return request<{ conversation_id: number }>(
      `/api/messages/with/${userId}`,
    );
  },
  sendText(conversationId: number, body: string, replyToId?: number) {
    return request<{ message: ChatMessage }>("/api/messages/send", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId,
        body,
        reply_to_id: replyToId,
      }),
    });
  },
  sendAttachment(opts: {
    conversation_id: number;
    kind: "voice" | "video" | "photo" | "file";
    filename: string;
    mime?: string;
    duration_ms?: number;
    width?: number;
    height?: number;
    body?: string;
    reply_to_id?: number;
  }) {
    return request<{ message: ChatMessage }>("/api/messages/send", {
      method: "POST",
      body: JSON.stringify({
        ...opts,
        attachment_filename: opts.filename,
        attachment_mime: opts.mime,
        attachment_duration_ms: opts.duration_ms,
        attachment_width: opts.width,
        attachment_height: opts.height,
      }),
    });
  },
  reactMessage(messageId: number, emoji: string) {
    return request<{ ok: true; removed: boolean }>(
      `/api/messages/${messageId}/react`,
      { method: "POST", body: JSON.stringify({ emoji }) },
    );
  },
  deleteMessage(messageId: number) {
    return request<{ ok: true }>(`/api/messages/${messageId}`, {
      method: "DELETE",
    });
  },

  // ── media ────────────────────────────────────────────────────────
  upload(file: Blob, filename = "upload.bin") {
    const fd = new FormData();
    fd.append(
      "file",
      file instanceof File ? file : new File([file], filename),
    );
    return requestForm<{
      filename: string;
      mime: string;
      kind: "photo" | "video" | "voice" | "file";
      duration_ms: number | null;
      width: number | null;
      height: number | null;
      size: number;
    }>("/api/media/upload", fd);
  },

  // ── reports ──────────────────────────────────────────────────────
  report(targetId: number, reason: string) {
    return request<{ ok: true }>("/api/reports", {
      method: "POST",
      body: JSON.stringify({ target_id: targetId, reason }),
    });
  },

  // ── referrals ────────────────────────────────────────────────────
  referrals() {
    return request<{
      count: number;
      items: PublicProfile[];
      ref_link: string;
    }>("/api/referrals");
  },

  // ── admin ────────────────────────────────────────────────────────
  adminStats() {
    return request<AdminStatsV2>("/api/admin/stats");
  },
  adminUsers(q = "", cursor = 0) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (cursor) p.set("cursor", String(cursor));
    return request<{ items: Me[]; next: number | null }>(
      `/api/admin/users${p.toString() ? `?${p}` : ""}`,
    );
  },
  adminTopReceived() {
    return request<{ items: { user_id: number; count: number }[] }>(
      "/api/admin/top/received",
    );
  },
  adminTopMatches() {
    return request<{ items: { user_id: number; count: number }[] }>(
      "/api/admin/top/matches",
    );
  },
  adminTopReferrers() {
    return request<{ items: { user_id: number; count: number }[] }>(
      "/api/admin/top/referrers",
    );
  },
  adminBan(userId: number) {
    return request<{ ok: true }>("/api/admin/ban", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },
  adminUnban(userId: number) {
    return request<{ ok: true }>("/api/admin/unban", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },
  adminDeleteUser(userId: number) {
    return request<{ ok: true }>(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
  },
  adminReports(status: "open" | "resolved" | "banned" | "all" = "open") {
    return request<{ items: ReportRow[] }>(
      `/api/admin/reports?status=${status}`,
    );
  },
  adminResolveReport(reportId: number, action: "resolve" | "ban") {
    return request<{ ok: true }>("/api/admin/reports/action", {
      method: "POST",
      body: JSON.stringify({ report_id: reportId, action }),
    });
  },
  adminBroadcast(text: string) {
    return request<{ ok: true; sent: number }>("/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
};

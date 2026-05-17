/**
 * Typed fetch client. Backend host is taken from ``NEXT_PUBLIC_API_URL`` so
 * the same bundle works for local dev (``http://localhost:8000``) and prod
 * (``https://match57.onrender.com``). All requests carry the auth cookie
 * (``credentials: "include"``).
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

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "https://match57.onrender.com"
).replace(/\/+$/, "");
const BASE = API_BASE;

export class APIError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

// Paths where a 401 is an expected business outcome (wrong password, not yet
// logged in) and must NOT trigger a global "session expired" redirect.
const AUTH_PATHS_NO_GLOBAL_401 = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/auth/logout",
]);

export const AUTH_EXPIRED_EVENT = "match57:auth-expired";

function _notifyAuthExpired(path: string) {
  if (typeof window === "undefined") return;
  if (AUTH_PATHS_NO_GLOBAL_401.has(path)) return;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

// Bearer-token fallback for browsers that refuse to keep our session
// cookie (iOS Safari with ITP, some embedded WebViews). The token is
// the same JWT the backend writes into the ``match57_session`` cookie
// — we just also persist a copy in localStorage and send it as
// ``Authorization: Bearer ...`` so authentication survives even when
// the cookie is blocked. Backend accepts either source (see
// ``backend/app/deps.py::session_payload``).
const AUTH_TOKEN_KEY = "match57:session_token";
// Same dual-track trick for the admin PIN second factor — see
// backend/app/deps.py::current_admin_pin.
const ADMIN_PIN_TOKEN_KEY = "match57:admin_pin_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    else window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* private mode etc — silently ignore */
  }
}

export function getAdminPinToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADMIN_PIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminPinToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(ADMIN_PIN_TOKEN_KEY, token);
    else window.localStorage.removeItem(ADMIN_PIN_TOKEN_KEY);
  } catch {
    /* private mode etc — silently ignore */
  }
}

function _authHeaders(path?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const t = getAuthToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  // Resend the PIN token on every /api/admin/* call so iOS Safari (which
  // drops the cross-site cookie) stays authenticated against the second
  // factor across page navigations.
  if (path && path.startsWith("/api/admin")) {
    const p = getAdminPinToken();
    if (p) headers["X-Admin-Pin"] = p;
  }
  return headers;
}

// 429 retry policy. Render's rate limiter clears in 0.7s; we wait a touch
// longer and retry up to 4 times so legitimate user actions (sending a
// message right after marking the conversation read, or sending an
// attachment right after upload) never bubble up as "not delivered".
const RETRY_429_ATTEMPTS = 4;
const RETRY_429_BASE_MS = 600;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const sec = Number(retryAfter);
    if (Number.isFinite(sec) && sec > 0) return Math.min(sec * 1000, 8000);
  }
  // 600ms, 1.2s, 2.4s, 4.8s + jitter.
  const base = Math.min(RETRY_429_BASE_MS * 2 ** attempt, 6000);
  return base * (0.85 + Math.random() * 0.3);
}

async function _readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return typeof body.detail === "string"
      ? body.detail
      : body.message || JSON.stringify(body);
  } catch {
    try {
      return await res.text();
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}

async function _fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < RETRY_429_ATTEMPTS; attempt += 1) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    if (attempt === RETRY_429_ATTEMPTS - 1) return res;
    const wait = backoffMs(attempt, res.headers.get("retry-after"));
    await sleep(wait);
  }
  // Unreachable — kept for type narrowing.
  return fetch(url, init);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Force a network fetch on every API call. Browsers and intermediate
  // proxies have been observed serving stale per-user responses (e.g.
  // /api/auth/me) when the platform CDN injects a permissive
  // `Cache-Control: public` and forgets to vary on Cookie. Belt + braces
  // with the backend's NoSharedCacheMiddleware.
  const res = await _fetchWithRetry(`${BASE}${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ..._authHeaders(path),
      ...(init.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    if (res.status === 401) _notifyAuthExpired(path);
    throw new APIError(res.status, (await _readError(res)) || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const res = await _fetchWithRetry(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { ..._authHeaders(path) },
    body,
  });
  if (!res.ok) {
    if (res.status === 401) _notifyAuthExpired(path);
    throw new APIError(res.status, (await _readError(res)) || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export type RegisterPayload = {
  username: string;
  password: string;
  name: string;
  age: number;
  gender: Gender;
  looking_for: LookingFor;
  description?: string;
  school?: string;
  phone?: string;
};

export type LeaderboardRow = {
  user_id: number;
  name: string;
  username: string | null;
  count: number;
};

export const api = {
  // ── auth ─────────────────────────────────────────────────────────
  async register(payload: RegisterPayload) {
    const res = await request<{ ok: true; user: Me; token?: string }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify(payload) },
    );
    if (res.token) setAuthToken(res.token);
    return res;
  },
  async login(username: string, password: string) {
    const res = await request<{ ok: true; user: Me; token?: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) },
    );
    if (res.token) setAuthToken(res.token);
    return res;
  },
  async logout() {
    try {
      return await request<{ ok: true }>("/api/auth/logout", { method: "POST" });
    } finally {
      setAuthToken(null);
    }
  },
  me() {
    return request<{ user: Me }>("/api/auth/me");
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
  forwardMessage(messageId: number, conversationId: number) {
    return request<{ message: ChatMessage }>(
      `/api/messages/${messageId}/forward`,
      { method: "POST", body: JSON.stringify({ conversation_id: conversationId }) },
    );
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

  // ── blocks ───────────────────────────────────────────────────────
  blockUser(targetId: number) {
    return request<{ ok: true; created: boolean; i_blocked: boolean; they_blocked: boolean }>(
      `/api/users/${targetId}/block`,
      { method: "POST" },
    );
  },
  unblockUser(targetId: number) {
    return request<{ ok: true; removed: boolean; i_blocked: boolean; they_blocked: boolean }>(
      `/api/users/${targetId}/block`,
      { method: "DELETE" },
    );
  },
  blockStatus(targetId: number) {
    return request<{ i_blocked: boolean; they_blocked: boolean }>(
      `/api/users/${targetId}/block`,
    );
  },
  blockedUsers() {
    return request<{ items: { user_id: number; name: string; username: string | null }[] }>(
      `/api/users/blocked`,
    );
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
  adminUser(userId: number) {
    return request<{ user: Me }>(`/api/admin/users/${userId}`);
  },
  adminTopReceived() {
    return request<{ items: LeaderboardRow[] }>("/api/admin/top/received");
  },
  adminTopMatches() {
    return request<{ items: LeaderboardRow[] }>("/api/admin/top/matches");
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
  adminRestoreUser(userId: number) {
    return request<{ ok: true }>(`/api/admin/users/${userId}/restore`, {
      method: "POST",
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

  // ── admin PIN gate ───────────────────────────────────────────────
  adminPinStatus() {
    return request<{ ok: boolean; required: boolean; ttl_minutes: number }>(
      "/api/admin/pin-status",
    );
  },
  async adminVerifyPin(pin: string) {
    const r = await request<{
      ok: true;
      required: boolean;
      ttl_minutes?: number;
      token?: string;
    }>("/api/admin/verify-pin", { method: "POST", body: JSON.stringify({ pin }) });
    if (r.token) setAdminPinToken(r.token);
    return r;
  },
  async adminLock() {
    try {
      return await request<{ ok: true }>("/api/admin/lock", { method: "POST" });
    } finally {
      setAdminPinToken(null);
    }
  },
};

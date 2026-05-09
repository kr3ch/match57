/**
 * Typed fetch client. The backend is mounted on the same origin in production
 * (via the Next.js rewrite in ``next.config.js``) and on a different port in
 * development. All requests carry the auth cookie (``credentials: include``).
 */
import type {
  AdminStats,
  LikeResult,
  Me,
  Profile,
  PublicProfile,
  ReferralInfo,
  ReportRow,
} from "./types";

const BASE = "";

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
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
    const err = new Error(detail || `HTTP ${res.status}`);
    (err as { status?: number }).status = res.status;
    throw err;
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
    const err = new Error(await res.text());
    (err as { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export const api = {
  // ---- auth -------------------------------------------------------
  loginTelegram(payload: Record<string, unknown>) {
    return request<Me>("/api/auth/telegram", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return request<{ ok: string }>("/api/auth/logout", { method: "POST" });
  },
  me() {
    return request<Me>("/api/auth/me");
  },

  // ---- registration / profile -------------------------------------
  register(payload: Omit<Profile, "user_id" | "username" | "created_at">) {
    return request<{ ok: true; profile: Profile }>("/api/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  myProfile() {
    return request<Profile>("/api/me");
  },
  updateDescription(description: string) {
    return request<Profile>("/api/me/description", {
      method: "PATCH",
      body: JSON.stringify({ description }),
    });
  },
  replacePhotos(photos: { type: "photo" | "video"; file_id: string }[]) {
    return request<Profile>("/api/me/photos", {
      method: "PUT",
      body: JSON.stringify({ photos }),
    });
  },
  uploadPhoto(file: File, kind: "photo" | "video") {
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    return requestForm<{ type: "photo" | "video"; file_id: string }>(
      "/api/me/photos/upload",
      fd,
    );
  },
  hide() {
    return request<{ ok: string }>("/api/me/hide", { method: "POST" });
  },
  unhide() {
    return request<{ ok: string }>("/api/me/unhide", { method: "POST" });
  },

  // ---- browse -----------------------------------------------------
  next(index: number) {
    return request<{
      profile: PublicProfile | null;
      caption?: string;
      remaining: number;
      index: number;
      next_index?: number;
    }>(`/api/browse/next?index=${index}`);
  },
  like(targetUserId: number) {
    return request<LikeResult>("/api/browse/like", {
      method: "POST",
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
  },
  dislike(targetUserId: number) {
    return request<{ ok: string }>("/api/browse/dislike", {
      method: "POST",
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
  },
  report(targetUserId: number, reason: string) {
    return request<{ ok: string }>("/api/browse/report", {
      method: "POST",
      body: JSON.stringify({ target_user_id: targetUserId, reason }),
    });
  },
  sendMessage(opts: {
    target_user_id: number;
    kind: "text" | "photo" | "video" | "voice" | "video_note";
    text?: string;
    file?: File;
  }) {
    const fd = new FormData();
    fd.append("target_user_id", String(opts.target_user_id));
    fd.append("kind", opts.kind);
    if (opts.text != null) fd.append("text", opts.text);
    if (opts.file) fd.append("file", opts.file);
    return requestForm<{
      delivered: boolean;
      match: boolean;
      contact: string | null;
    }>("/api/browse/message", fd);
  },

  // ---- skipped ----------------------------------------------------
  skipped() {
    return request<{
      items: (PublicProfile & { caption: string })[];
      count: number;
    }>("/api/skipped");
  },
  clearSkipped() {
    return request<{ removed: number }>("/api/skipped/clear", {
      method: "POST",
    });
  },

  // ---- likes / matches --------------------------------------------
  incomingLikes() {
    return request<{
      items: (PublicProfile & { caption: string })[];
      count: number;
    }>("/api/likes/incoming");
  },
  matches() {
    return request<{
      items: {
        user_id: number;
        name: string;
        age: number;
        gender: string;
        username?: string | null;
        photos: { type: string; file_id: string }[];
      }[];
      count: number;
    }>("/api/likes/matches");
  },

  // ---- referrals --------------------------------------------------
  referral() {
    return request<ReferralInfo>("/api/me/referral");
  },

  // ---- admin ------------------------------------------------------
  adminStats() {
    return request<AdminStats>("/api/admin/stats");
  },
  adminTop(kind: "active" | "likes" | "referrers", limit = 10) {
    const map = { active: "top-active", likes: "top-likes", referrers: "top-referrers" } as const;
    return request<{ items: Profile[] }>(`/api/admin/${map[kind]}?limit=${limit}`);
  },
  adminLoners() {
    return request<{ items: Profile[] }>("/api/admin/loners");
  },
  adminNewToday() {
    return request<{ items: Profile[] }>("/api/admin/new-today");
  },
  adminUsers(page: number, pageSize = 10) {
    return request<{
      items: (Profile & { banned: boolean })[];
      total: number;
      page: number;
      page_size: number;
      has_next: boolean;
    }>(`/api/admin/users?page=${page}&page_size=${pageSize}`);
  },
  adminSearch(q: string) {
    return request<{ items: Profile[] }>(
      `/api/admin/users/search?q=${encodeURIComponent(q)}`,
    );
  },
  adminUser(userId: number) {
    return request<Profile & { banned: boolean }>(
      `/api/admin/users/${userId}`,
    );
  },
  adminBan(userId: number) {
    return request<{ ok: string }>(`/api/admin/users/${userId}/ban`, {
      method: "POST",
    });
  },
  adminUnban(userId: number) {
    return request<{ ok: string }>(`/api/admin/users/${userId}/unban`, {
      method: "POST",
    });
  },
  adminDelete(userId: number) {
    return request<{ ok: string }>(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
  },
  adminDM(userId: number, text: string) {
    return request<{ delivered: boolean }>("/api/admin/dm", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, text }),
    });
  },
  adminBroadcast(text: string) {
    return request<{ sent: number; failed: number }>("/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
  adminReports() {
    return request<{ items: ReportRow[] }>("/api/admin/reports");
  },
  adminResolve(index: number) {
    return request<{ ok: string }>(`/api/admin/reports/${index}/resolve`, {
      method: "POST",
    });
  },
  adminBanFromReport(index: number) {
    return request<{ ok: string }>(
      `/api/admin/reports/${index}/ban-target`,
      { method: "POST" },
    );
  },
  adminDeleteFromReport(index: number) {
    return request<{ ok: string }>(
      `/api/admin/reports/${index}/delete-target`,
      { method: "POST" },
    );
  },
};

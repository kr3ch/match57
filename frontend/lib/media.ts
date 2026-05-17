/**
 * Helper to build a `<img>` / `<video>` URL for a stored media item.
 *
 * Uses the same backend origin as the API client so uploads are served from
 * the backend (Render) and not the static frontend host (Vercel).
 */
import { API_BASE, getAuthToken } from "./api";

export function mediaUrl(userId: number, filename: string): string {
  const base = `${API_BASE}/api/media/${userId}/${encodeURIComponent(filename)}`;
  // <img>/<video> tags can't attach an Authorization header, so the
  // browser would normally rely on our session cookie for chat-
  // attachment media. iOS Safari (ITP) refuses to send our cross-site
  // cookie, which would render a broken-image square. Forward the JWT
  // as a ``?token=`` query param when we have one; backend accepts
  // cookie, Authorization header, OR query param. Profile photos are
  // served unconditionally so this is only meaningful for chat media.
  const t = getAuthToken();
  return t ? `${base}?token=${encodeURIComponent(t)}` : base;
}

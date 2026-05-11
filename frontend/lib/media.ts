/**
 * Helper to build a `<img>` / `<video>` URL for a stored media item.
 *
 * Uses the same backend origin as the API client so uploads are served from
 * the backend (Render) and not the static frontend host (Vercel).
 */
import { API_BASE } from "./api";

export function mediaUrl(userId: number, filename: string): string {
  return `${API_BASE}/api/media/${userId}/${encodeURIComponent(filename)}`;
}

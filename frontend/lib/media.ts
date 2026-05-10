/**
 * Helper to build a `<img>` / `<video>` URL for a stored media item.
 * In production (static export) the backend lives on a different origin; we
 * read the base URL from ``NEXT_PUBLIC_API_BASE`` so paths resolve correctly.
 */
import { API_BASE } from "./api";

export function mediaUrl(userId: number, filename: string): string {
  return `${API_BASE}/api/media/${userId}/${encodeURIComponent(filename)}`;
}

/**
 * Helper to build a `<img>` / `<video>` URL for a stored media item.
 */

export function mediaUrl(userId: number, filename: string): string {
  return `/api/media/${userId}/${encodeURIComponent(filename)}`;
}

/** Build the URL of the media-proxy for a given Telegram file_id. */
export function mediaUrl(fileId: string): string {
  return `/api/media/${encodeURIComponent(fileId)}`;
}

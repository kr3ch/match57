/**
 * Presence + last-seen formatting helpers.
 *
 * Backend exposes ``online: bool`` (WS-driven, see services/messaging.py) and
 * ``last_seen_at: ISO``. We render the human-friendly string in one place so
 * the chat header, conversation list, and any future presence indicator
 * stay consistent.
 */

import { useEffect, useState } from "react";

/** Tick-rerender hook. Returns a "tick" number that increments on each
 *  ``intervalMs``. Use it to keep relative-time labels fresh without
 *  re-fetching from the API. */
export function useTicker(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return tick;
}

const RU_MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

/** Time-since-`when` rendered like Telegram: "2 мин", "1 ч", "вчера в 14:30",
 *  "12 мая в 11:05". Always gender-neutral so we can use it for both genders.
 */
export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "давно не заходил(а)";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "давно не заходил(а)";
  const now = Date.now();
  const diff = Math.max(0, now - t);
  if (diff < 60_000) return "только что";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(diff / 3_600_000);
  // Same calendar day → "в HH:MM"
  const date = new Date(t);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = date.toDateString() === today.toDateString();
  const wasYesterday = date.toDateString() === yesterday.toDateString();
  const hhmm = `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  if (sameDay) {
    return hr < 1 ? `${min} мин назад` : `${hr} ч назад`;
  }
  if (wasYesterday) return `вчера в ${hhmm}`;
  // Within last 7 days → weekday + time.
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days} дн назад`;
  const sameYear = date.getFullYear() === today.getFullYear();
  const dm = `${date.getDate()} ${RU_MONTHS[date.getMonth()]}`;
  return sameYear ? dm : `${dm} ${date.getFullYear()}`;
}

/** Top-level presence label used in the chat header. */
export function presenceLabel(opts: {
  typing?: boolean;
  online: boolean;
  lastSeenAt?: string | null;
}): string {
  if (opts.typing) return "печатает…";
  if (opts.online) return "в сети";
  if (!opts.lastSeenAt) return "не в сети";
  return `был(а) ${formatLastSeen(opts.lastSeenAt)}`;
}

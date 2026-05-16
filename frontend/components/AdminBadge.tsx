"use client";

import { cn } from "@/lib/cn";

/**
 * Minimal, verified-style badge for staff accounts. Small enough to live
 * inline with a name, and uses the existing gold palette so it doesn't
 * compete with the ember/rose accents.
 */
export function AdminBadge({
  size = "sm",
  className,
  label = "АДМИН",
}: {
  size?: "xs" | "sm" | "md";
  className?: string;
  label?: string;
}) {
  const sizing =
    size === "xs"
      ? "text-[9px] px-1.5 py-[1px] gap-1"
      : size === "md"
        ? "text-[11px] px-2.5 py-1 gap-1.5"
        : "text-[10px] px-2 py-[2px] gap-1";

  return (
    <span
      title="Подтверждённый администратор"
      className={cn(
        "inline-flex select-none items-center rounded-full border border-gold-200/40 bg-gold-100/15 font-semibold uppercase tracking-[0.18em] text-gold-100 shadow-[0_0_0_1px_rgba(232,210,122,0.06)_inset]",
        sizing,
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className={cn(
          "shrink-0 fill-gold-200",
          size === "xs" ? "h-2.5 w-2.5" : size === "md" ? "h-3.5 w-3.5" : "h-3 w-3",
        )}
      >
        <path d="M8 1.2l1.7 1.4 2.2-.3.7 2.1 2 1-.6 2.1.8 2-1.9 1.2-.5 2.1-2.2.1-1.6 1.5-1.6-1.5-2.2-.1-.5-2.1L2.5 9.4l.8-2-.6-2.1 2-1 .7-2.1 2.2.3L8 1.2zm-.7 8.4l3.7-3.7-1-1L7.3 7.6 6 6.3l-1 1 2.3 2.3z" />
      </svg>
      {label}
    </span>
  );
}

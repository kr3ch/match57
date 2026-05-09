"use client";

import Link from "next/link";

import { useNotifications } from "./providers/NotificationProvider";

export function Toaster() {
  const { toasts, dismiss } = useNotifications();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white/10 px-4 py-3 text-sm shadow-2xl ring-1 ring-white/15 backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {t.href ? (
                <Link href={t.href} onClick={() => dismiss(t.id)}>
                  <div className="font-semibold">{t.title}</div>
                  {t.body && (
                    <div className="text-xs text-white/70 line-clamp-2">{t.body}</div>
                  )}
                </Link>
              ) : (
                <>
                  <div className="font-semibold">{t.title}</div>
                  {t.body && (
                    <div className="text-xs text-white/70 line-clamp-2">{t.body}</div>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              className="text-white/40 hover:text-white"
              onClick={() => dismiss(t.id)}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

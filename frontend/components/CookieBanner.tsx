"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "match57_cookie_consent_v1";

/**
 * Tiny GDPR-style notice that pins to the bottom of every page until the
 * user dismisses it. Persistence lives in ``localStorage``; the banner does
 * *not* gate functionality — the app can't work without first-party auth
 * cookies, so we just communicate that. SSR-safe: we only render after
 * mount so the markup matches what hydration expects.
 */
export function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [accepted, setAccepted] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      setAccepted(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setAccepted(false);
    }
  }, []);

  if (!mounted || accepted) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode etc. */
    }
    setAccepted(true);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 sm:pb-4">
      <div
        role="region"
        aria-label="Уведомление о cookies"
        className="pointer-events-auto glass flex w-full max-w-2xl items-center gap-3 px-4 py-3 text-sm shadow-card backdrop-blur"
      >
        <span aria-hidden="true" className="text-base">🍪</span>
        <p className="flex-1 text-ink-100/85">
          Сайт использует <strong className="text-ink-50">cookies для входа</strong>.
          Без них приложение работать не будет — авторизация, чаты и админка
          держатся на них.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full bg-ember-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-950 transition hover:brightness-110 active:scale-[0.98]"
        >
          ок
        </button>
      </div>
    </div>
  );
}

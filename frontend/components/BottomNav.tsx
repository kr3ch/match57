"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";

type Tab = { href: string; label: string; icon: string };

const TABS: Tab[] = [
  { href: "/swipe", label: "Поиск", icon: "🔍" },
  { href: "/likes", label: "Лайки", icon: "❤️" },
  { href: "/matches", label: "Мэтчи", icon: "🔥" },
  { href: "/chats", label: "Чаты", icon: "💬" },
  { href: "/profile", label: "Я", icon: "👤" },
];

type Bubble = { id: number; href: string };

let _bubbleSeq = 1;

export function BottomNav() {
  const pathname = usePathname();
  const { me } = useAuth();
  const { subscribe } = useRealtime();
  const tabs = me?.is_admin
    ? [...TABS, { href: "/admin", label: "Админ", icon: "⚙️" }]
    : TABS;

  // Floating "+1" bubbles, anchored to whichever tab href is most relevant
  // for the incoming realtime event. They auto-disappear after a short
  // delay; the user sees one bubble per event, even if they fire rapidly.
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!me) return;
    const unsub = subscribe((evt) => {
      let href: string | null = null;
      if (evt.type === "like") href = "/likes";
      else if (evt.type === "match") href = "/matches";
      if (!href) return;
      if (pathname?.startsWith(href)) return;
      const id = _bubbleSeq++;
      setBubbles((prev) => [...prev, { id, href: href! }]);
      const t = setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.id !== id));
        timeoutsRef.current.delete(id);
      }, 1800);
      timeoutsRef.current.set(id, t);
    });
    return () => {
      unsub();
    };
  }, [me, subscribe, pathname]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
    };
  }, []);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-2xl px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3"
      aria-label="Главная навигация"
    >
      <div className="glass flex justify-between gap-1 px-2 py-2 sm:gap-3 sm:px-3">
        {tabs.map((t) => {
          const active = pathname?.startsWith(t.href);
          const tabBubbles = bubbles.filter((b) => b.href === t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[11px] uppercase tracking-[0.18em] transition",
                active
                  ? "text-ink-50"
                  : "text-ink-200/70 hover:text-ink-50",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="absolute inset-0 -z-10 rounded-2xl bg-white/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              ) : null}
              <span className="text-base leading-none" aria-hidden>
                {t.icon}
              </span>
              <span>{t.label}</span>

              <AnimatePresence>
                {tabBubbles.map((b) => (
                  <motion.span
                    key={b.id}
                    initial={{ opacity: 0, y: 6, scale: 0.8 }}
                    animate={{ opacity: 1, y: -22, scale: 1 }}
                    exit={{ opacity: 0, y: -38, scale: 0.95 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 select-none rounded-full bg-ember-500/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-normal text-ember-50 shadow-[0_4px_20px_rgba(244,134,90,0.55)] ring-1 ring-ember-200/60"
                  >
                    +1
                  </motion.span>
                ))}
              </AnimatePresence>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/providers/AuthProvider";

const TABS = [
  { href: "/swipe", label: "Поиск", icon: "✦" },
  { href: "/likes", label: "Лайки", icon: "❤" },
  { href: "/matches", label: "Мэтчи", icon: "✸" },
  { href: "/chats", label: "Чаты", icon: "✉" },
  { href: "/profile", label: "Я", icon: "◍" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { me } = useAuth();
  const tabs = me?.is_admin
    ? [...TABS, { href: "/admin", label: "Админ", icon: "✜" }]
    : TABS;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-2xl px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3"
      aria-label="Главная навигация"
    >
      <div className="glass flex justify-between gap-1 px-2 py-2 sm:gap-3 sm:px-3">
        {tabs.map((t) => {
          const active = pathname?.startsWith(t.href);
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

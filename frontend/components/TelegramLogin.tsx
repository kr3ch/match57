"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

type Props = {
  referrerId?: number | null;
};

/**
 * Wraps the official Telegram Login Widget. Telegram injects an iframe with
 * its branded button; on success it calls our global ``onTelegramAuth`` with
 * a payload that we forward to the backend for HMAC verification.
 */
export function TelegramLogin({ referrerId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { refresh } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const username = process.env.NEXT_PUBLIC_BOT_USERNAME;
    if (!username) return;

    window.onTelegramAuth = async (user) => {
      try {
        const payload: Record<string, unknown> = { ...user };
        if (referrerId != null) payload.ref = referrerId;
        const me = await api.loginTelegram(payload);
        await refresh();
        toast({
          title: me.registered ? `С возвращением, ${me.username ?? "друг"}!` : "Готово!",
          body: me.registered
            ? "Открываем твой профиль…"
            : "Заполни анкету за пару минут.",
        });
        router.push(me.registered ? "/swipe" : "/register");
      } catch (e) {
        toast({
          title: "Не удалось войти",
          body: (e as Error).message,
          tone: "error",
        });
      }
    };

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", username);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "20");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    containerRef.current?.appendChild(script);
    const node = containerRef.current;
    return () => {
      delete window.onTelegramAuth;
      if (node) node.innerHTML = "";
    };
  }, [refresh, router, referrerId]);

  if (!process.env.NEXT_PUBLIC_BOT_USERNAME) {
    return (
      <div className="glass-soft px-4 py-3 text-sm text-rose-200">
        ⚠️ Не задан <code>NEXT_PUBLIC_BOT_USERNAME</code> — кнопка входа через
        Telegram не появится. Поставь имя бота в <code>.env.local</code>.
      </div>
    );
  }

  return <div ref={containerRef} className="tg-login flex justify-center" />;
}

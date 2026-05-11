"use client";

import { useRouter } from "next/navigation";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "./AuthProvider";
import { useRealtime } from "./RealtimeProvider";

type Toast = { id: number; title: string; body?: string; href?: string };

type NotifCtx = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
  permitted: boolean;
  requestPermission: () => Promise<void>;
};

const Ctx = createContext<NotifCtx | null>(null);

const NOTIFY_SOUND_DATA_URI =
  // tiny 100ms 880Hz beep, generated once and base64-encoded.
  "data:audio/wav;base64,UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACAgICAgICAgICAgIA=";

let _audio: HTMLAudioElement | null = null;
function playSound() {
  try {
    if (!_audio) {
      _audio = new Audio(NOTIFY_SOUND_DATA_URI);
      _audio.volume = 0.4;
    }
    _audio.currentTime = 0;
    _audio.play().catch(() => {});
  } catch {}
}

let _seq = 1;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const { subscribe } = useRealtime();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [permitted, setPermitted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    setPermitted(Notification.permission === "granted");
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermitted(result === "granted");
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = _seq++;
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 5500);

      playSound();

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.visibilityState !== "visible"
      ) {
        try {
          const n = new Notification(t.title, { body: t.body });
          if (t.href) {
            n.onclick = () => {
              window.focus();
              router.push(t.href!);
            };
          }
        } catch {}
      }
    },
    [router],
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  // Hook into realtime events to surface notifications. Depend on
  // me?.user_id (not the whole me object) so we don't churn the
  // subscription on every auth refresh.
  const myUserId = me?.user_id ?? null;
  useEffect(() => {
    if (myUserId === null) return;
    return subscribe((evt) => {
      if (evt.type === "match") {
        push({
          title: "Новый мэтч!",
          body: `${evt.user.name}, ${evt.user.age}`,
          href: `/chat?id=${evt.conversation_id}`,
        });
      } else if (evt.type === "like") {
        push({
          title: "Кто-то лайкнул вас",
          body: "Откройте «Лайки», чтобы увидеть",
          href: "/likes",
        });
      } else if (evt.type === "message" && evt.message?.from_user_id !== myUserId) {
        push({
          title: "Новое сообщение",
          body:
            evt.message.kind === "text"
              ? evt.message.body || ""
              : `📎 ${evt.message.kind}`,
          href: `/chat?id=${evt.message.conversation_id}`,
        });
      }
    });
  }, [myUserId, subscribe, push]);

  const value = useMemo(
    () => ({ toasts, push, dismiss, permitted, requestPermission }),
    [toasts, push, dismiss, permitted, requestPermission],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const v = useContext(Ctx);
  if (!v) throw new Error("NotificationProvider missing");
  return v;
}

"use client";

import { useRouter } from "next/navigation";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "./AuthProvider";
import { useRealtime } from "./RealtimeProvider";

type Toast = { id: number; title: string; body?: string; href?: string };

type NotifCtx = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
  /** Browser-level permission granted? Read-only mirror of Notification.permission. */
  permitted: boolean;
  requestPermission: () => Promise<void>;
  /** User-level toggle: are in-site toasts + OS notifications fired at all? */
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** User-level toggle: is the beep played when a toast is pushed? */
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
};

const Ctx = createContext<NotifCtx | null>(null);

const LS_ENABLED = "match57:notif:enabled";
const LS_SOUND = "match57:notif:sound";

/**
 * Lazily instantiate a single shared AudioContext and play a short two-tone
 * "ding" via an oscillator. The previous implementation used a base64 WAV
 * blob that was actually 10 bytes of silence (0x80 = the zero point for
 * 8-bit unsigned PCM), which is why users reported "notifications don't
 * make a sound". WebAudio also avoids autoplay restrictions on HTMLAudio
 * because it's gated by a user gesture earlier in the session.
 */
let _ac: AudioContext | null = null;
function playSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!_ac) _ac = new Ctor();
    const ac = _ac;
    if (ac.state === "suspended") {
      void ac.resume().catch(() => {});
    }
    const now = ac.currentTime;
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.25, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    };
    beep(880, 0, 0.12);
    beep(1320, 0.09, 0.16);
  } catch {
    // AudioContext can throw on some Safari versions when the document is
    // not yet user-activated; we silently no-op rather than spam the user.
  }
}

let _seq = 1;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { me, refresh } = useAuth();
  const { subscribe } = useRealtime();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [permitted, setPermitted] = useState(false);
  // Default both toggles ON, so existing behavior is preserved for users
  // who have never opened settings. They are persisted in localStorage so
  // the choice survives reloads.
  const [enabled, _setEnabled] = useState(true);
  const [soundEnabled, _setSoundEnabled] = useState(true);
  // We mirror toggles in a ref so the WS subscribe callback can read the
  // current value without re-subscribing on every toggle change (which
  // would unsubscribe + miss events landing exactly at the swap).
  const enabledRef = useRef(true);
  const soundRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    setPermitted(Notification.permission === "granted");
    try {
      const e = localStorage.getItem(LS_ENABLED);
      const s = localStorage.getItem(LS_SOUND);
      if (e !== null) {
        const v = e === "1";
        _setEnabled(v);
        enabledRef.current = v;
      }
      if (s !== null) {
        const v = s === "1";
        _setSoundEnabled(v);
        soundRef.current = v;
      }
    } catch {}
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    _setEnabled(v);
    enabledRef.current = v;
    try {
      localStorage.setItem(LS_ENABLED, v ? "1" : "0");
    } catch {}
  }, []);

  const setSoundEnabled = useCallback((v: boolean) => {
    _setSoundEnabled(v);
    soundRef.current = v;
    try {
      localStorage.setItem(LS_SOUND, v ? "1" : "0");
    } catch {}
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermitted(result === "granted");
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      if (!enabledRef.current) return;
      const id = _seq++;
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 5500);

      if (soundRef.current) playSound();

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

  // Hook into realtime events to surface notifications.
  useEffect(() => {
    if (!me) return;
    return subscribe((evt) => {
      if (evt.type === "match") {
        push({
          title: "Новый мэтч!",
          body: `${evt.user.name}, ${evt.user.age}`,
          href: `/chats/${evt.conversation_id}`,
        });
      } else if (evt.type === "like") {
        push({
          title: "Кто-то лайкнул вас",
          body: "Откройте «Лайки», чтобы увидеть",
          href: "/likes",
        });
      } else if (
        evt.type === "banned" ||
        evt.type === "unbanned" ||
        evt.type === "deleted"
      ) {
        // Re-fetch /me so the ban gate clears (or activates) without the
        // user having to reload the tab. Symmetric handling means an admin
        // unban is reflected in the UI in real time.
        void refresh();
        return;
      } else if (evt.type === "message" && evt.message?.from_user_id !== me.user_id) {
        const senderName = evt.sender_name || "Кто-то";
        const body =
          evt.message.kind === "text"
            ? evt.message.body || ""
            : evt.message.kind === "voice"
              ? "🎙 голосовое"
              : evt.message.kind === "video"
                ? "📹 видео"
                : evt.message.kind === "photo"
                  ? "📷 фото"
                  : "📎 файл";
        push({
          title: senderName,
          body,
          href: `/chats/${evt.message.conversation_id}`,
        });
      }
    });
  }, [me, subscribe, push, refresh]);

  const value = useMemo(
    () => ({
      toasts,
      push,
      dismiss,
      permitted,
      requestPermission,
      enabled,
      setEnabled,
      soundEnabled,
      setSoundEnabled,
    }),
    [
      toasts,
      push,
      dismiss,
      permitted,
      requestPermission,
      enabled,
      setEnabled,
      soundEnabled,
      setSoundEnabled,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const v = useContext(Ctx);
  if (!v) throw new Error("NotificationProvider missing");
  return v;
}

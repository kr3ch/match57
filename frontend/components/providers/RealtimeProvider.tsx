"use client";

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

import { API_BASE, getAuthToken } from "@/lib/api";

import { useAuth } from "./AuthProvider";

export type WSEvent =
  | { type: "ping" }
  | { type: "pong" }
  | { type: "message"; message: any; sender_name?: string }
  | { type: "typing"; conversation_id: number; user_id: number; is_typing: boolean }
  | { type: "read"; message_id: number; user_id: number; conversation_id: number }
  | { type: "presence"; user_id: number; online: boolean; last_seen_at: string | null }
  | { type: "match"; user: any; conversation_id: number }
  | { type: "like"; from_user: any }
  | {
      type: "reaction";
      message_id: number;
      user_id: number;
      emoji: string;
      removed: boolean;
    }
  | { type: "banned" }
  | { type: "unbanned" }
  | { type: "deleted" }
  | { type: "restored" };

type Listener = (e: WSEvent) => void;

type RealtimeCtx = {
  connected: boolean;
  send: (msg: object) => void;
  subscribe: (l: Listener) => () => void;
  online: Set<number>;
  /**
   * Increments every time the WebSocket *re-opens* after being closed.
   * Consumers (e.g. chat page) can depend on this to refetch missed
   * history when the underlying socket bounces — Render/Vercel idle
   * timeouts and mobile network handoffs make this critical.
   */
  reconnectNonce: number;
};

const Ctx = createContext<RealtimeCtx | null>(null);

// Keepalive cadence — must stay under the proxy idle timeout. Render's edge
// closes WS sockets after ~100s of inactivity, so 25s is comfortably safe.
const PING_INTERVAL_MS = 25_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

function wsUrl() {
  if (typeof window === "undefined") return "";
  // WebSocket must hit the backend (Render), not the static frontend host
  // (Vercel). Derive ws(s):// from the same origin used by the REST client.
  const base = `${API_BASE.replace(/^http/, "ws")}/api/ws`;
  // iOS Safari (ITP) won't send our cross-site session cookie on the WS
  // upgrade. Append the Bearer token as a query param so the server can
  // authenticate the socket on those browsers. Harmless on browsers where
  // cookies do work — backend prefers the cookie when present.
  const t = getAuthToken();
  return t ? `${base}?token=${encodeURIComponent(t)}` : base;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<Set<number>>(new Set());
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const openedOnceRef = useRef(false);

  const subscribe = useCallback((l: Listener) => {
    listenersRef.current.add(l);
    return () => {
      listenersRef.current.delete(l);
    };
  }, []);

  const send = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!me) {
      const ws = wsRef.current;
      if (ws) {
        ws.close();
        wsRef.current = null;
      }
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      setConnected(false);
      openedOnceRef.current = false;
      attemptRef.current = 0;
      return;
    }

    let closedByEffect = false;

    const scheduleReconnect = () => {
      if (closedByEffect) return;
      const attempt = Math.min(attemptRef.current, 6);
      const base = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
      // Add ±30% jitter so reconnect storms don't synchronize across tabs.
      const jitter = base * (0.7 + Math.random() * 0.6);
      attemptRef.current += 1;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = window.setTimeout(connect, jitter);
    };

    const connect = () => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl());
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        attemptRef.current = 0;
        if (openedOnceRef.current) {
          // Notify consumers (chat page) so they can refetch history that
          // arrived while we were offline.
          setReconnectNonce((n) => n + 1);
        }
        openedOnceRef.current = true;
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        pingTimerRef.current = window.setInterval(() => {
          const sock = wsRef.current;
          if (sock && sock.readyState === WebSocket.OPEN) {
            try {
              sock.send(JSON.stringify({ type: "ping" }));
            } catch {
              /* ignore — onclose will fire */
            }
          }
        }, PING_INTERVAL_MS);
      };
      ws.onclose = () => {
        setConnected(false);
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        scheduleReconnect();
      };
      ws.onerror = () => {
        // Let onclose drive reconnect — onerror always precedes it.
      };
      ws.onmessage = (evt) => {
        try {
          const data: WSEvent = JSON.parse(evt.data);
          if (data.type === "pong") return;
          if (data.type === "presence") {
            setOnline((prev) => {
              const next = new Set(prev);
              if (data.online) next.add(data.user_id);
              else next.delete(data.user_id);
              return next;
            });
          }
          listenersRef.current.forEach((l) => l(data));
        } catch (err) {
          console.error("ws parse failed", err);
        }
      };
    };

    // Reconnect immediately when the tab regains focus / network. Mobile
    // browsers often pause sockets in background — without this the user
    // sees "online" but messages never arrive until they retype.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const sock = wsRef.current;
      if (!sock || sock.readyState === WebSocket.CLOSED) {
        attemptRef.current = 0;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        connect();
      }
    };
    const onOnline = () => {
      attemptRef.current = 0;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      const sock = wsRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) connect();
    };
    // Explicitly close the WebSocket when the tab/browser is being closed so
    // the server receives a clean disconnect and broadcasts offline status
    // immediately instead of waiting for the TCP timeout.
    const onBeforeUnload = () => {
      const sock = wsRef.current;
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.close();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);

    connect();
    return () => {
      closedByEffect = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      const ws = wsRef.current;
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, [me]);

  const value = useMemo(
    () => ({ connected, send, subscribe, online, reconnectNonce }),
    [connected, send, subscribe, online, reconnectNonce],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRealtime() {
  const v = useContext(Ctx);
  if (!v) throw new Error("RealtimeProvider missing");
  return v;
}

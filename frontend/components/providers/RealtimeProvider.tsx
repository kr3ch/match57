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

import { API_BASE } from "@/lib/api";

import { useAuth } from "./AuthProvider";

export type WSEvent =
  | { type: "ping" }
  | { type: "pong" }
  | { type: "message"; message: any }
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
    };

type Listener = (e: WSEvent) => void;

type RealtimeCtx = {
  connected: boolean;
  send: (msg: object) => void;
  subscribe: (l: Listener) => () => void;
  online: Set<number>;
};

const Ctx = createContext<RealtimeCtx | null>(null);

function wsUrl() {
  if (typeof window === "undefined") return "";
  // WebSocket must hit the backend (Render), not the static frontend host
  // (Vercel). Derive ws(s):// from the same origin used by the REST client.
  return `${API_BASE.replace(/^http/, "ws")}/api/ws`;
}

// Reconnect strategy: start at 1.5s, double on each failure up to 30s. Resets
// on a successful open. This prevents hammering the backend during a Render
// free-tier cold start (which can take 30-60s to wake up).
const RECONNECT_MIN_MS = 1500;
const RECONNECT_MAX_MS = 30_000;
// Render's edge idles silent WebSockets after ~60s. The backend has a
// {"type": "ping"} → {"type": "pong"} echo so the client must drive a
// heartbeat to keep the socket alive.
const PING_INTERVAL_MS = 25_000;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<Set<number>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const reconnectDelayRef = useRef<number>(RECONNECT_MIN_MS);

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
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      setConnected(false);
      return;
    }

    let closedByEffect = false;

    const clearPing = () => {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    const connect = () => {
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        reconnectDelayRef.current = RECONNECT_MIN_MS;
        clearPing();
        pingTimerRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: "ping" }));
            } catch {
              /* socket about to close — the onclose handler will reconnect */
            }
          }
        }, PING_INTERVAL_MS);
      };
      ws.onclose = () => {
        setConnected(false);
        clearPing();
        if (!closedByEffect) {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(delay * 2, RECONNECT_MAX_MS);
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        }
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

    connect();
    return () => {
      closedByEffect = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      clearPing();
      const ws = wsRef.current;
      if (ws) ws.close();
      wsRef.current = null;
      reconnectDelayRef.current = RECONNECT_MIN_MS;
    };
  }, [me]);

  const value = useMemo(
    () => ({ connected, send, subscribe, online }),
    [connected, send, subscribe, online],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRealtime() {
  const v = useContext(Ctx);
  if (!v) throw new Error("RealtimeProvider missing");
  return v;
}

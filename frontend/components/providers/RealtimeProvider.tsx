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
  // Next.js dev rewrites do NOT proxy WebSocket upgrades, so when running
  // ``npm run dev`` on :3000 against a local FastAPI on :8000 we must
  // talk to the backend directly. In production, NEXT_PUBLIC_API_BASE is
  // set at build time to the deployed backend host.
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE ||
    (window.location.host === "localhost:3000" ? "http://localhost:8000" : "");
  if (apiBase) {
    try {
      const url = new URL(apiBase);
      const proto = url.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${url.host}/api/ws`;
    } catch {
      // fall through to same-origin
    }
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/ws`;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<Set<number>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const reconnectTimerRef = useRef<number | null>(null);

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
      setConnected(false);
      return;
    }

    let closedByEffect = false;

    const connect = () => {
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closedByEffect) {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = window.setTimeout(connect, 1500);
        }
      };
      ws.onmessage = (evt) => {
        try {
          const data: WSEvent = JSON.parse(evt.data);
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
      const ws = wsRef.current;
      if (ws) ws.close();
      wsRef.current = null;
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

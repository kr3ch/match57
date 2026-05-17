"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { APIError, AUTH_EXPIRED_EVENT, api, setAuthToken } from "@/lib/api";
import type { Me } from "@/lib/types";

type AuthGate = "banned" | "deleted" | null;

type AuthCtx = {
  me: Me | null;
  loading: boolean;
  gate: AuthGate;
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
  setMe: (m: Me | null) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [gate, setGate] = useState<AuthGate>(null);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setMe(user);
      setGate(null);
      return user;
    } catch (e) {
      if (e instanceof APIError) {
        if (e.status === 403 && e.detail === "banned") {
          setMe(null);
          setGate("banned");
          return null;
        }
        if (e.status === 403 && e.detail === "deleted") {
          setMe(null);
          setGate("deleted");
          return null;
        }
        if (e.status === 401 && e.detail === "user_not_found") {
          setMe(null);
          setGate("deleted");
          return null;
        }
        if (e.status === 401) {
          setMe(null);
          setGate(null);
          return null;
        }
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Any API call returning 401 (e.g. after Render redeploy invalidates the
  // server-side session epoch, or the cookie expires) fires the
  // `match57:auth-expired` window event. We drop local auth state so the
  // protected-page gate below redirects to /login; otherwise the page would
  // sit on a permanent "Грузим…" while SWR silently retries 401s forever.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onExpired = () => {
      // The persisted Bearer token clearly isn't accepted anymore (either
      // expired or the server epoch rotated). Drop it so we don't keep
      // re-sending a known-bad token on every retry.
      setAuthToken(null);
      setMe(null);
      setGate(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  // While the user sits on a gate screen ("Вы заблокированы" / "Аккаунт
  // удалён") the AuthProvider renders the gate UI in place of children,
  // so the WebSocket provider never even mounts. Realtime ban/unban/
  // delete/restore events therefore can't reach this tab through WS —
  // poll `/me` aggressively (every 3s) so that as soon as the admin
  // flips the user's state, the gate clears within a few seconds. The
  // request is cheap (single indexed lookup + JWT verify) and only runs
  // while the tab is parked on a gate screen.
  useEffect(() => {
    if (!gate) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 3_000);
    return () => window.clearInterval(id);
  }, [gate, refresh]);

  // Auth gate: bounce protected pages to /login when unauthenticated.
  useEffect(() => {
    if (loading) return;
    if (gate) return; // banned/deleted screens handle themselves
    const isPublic = PUBLIC_PATHS.has(pathname);
    if (!me && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, me, gate, pathname, router]);

  const logout = useCallback(async () => {
    await api.logout();
    setMe(null);
    setGate(null);
    router.replace("/");
  }, [router]);

  if (!loading && gate === "banned") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass max-w-sm p-8 text-center">
          <div className="text-4xl">🚫</div>
          <h1 className="display mt-4 text-2xl text-ink-50">
            Вы заблокированы
          </h1>
          <p className="mt-3 text-sm text-ink-200/70">
            Если хотите получить разблокировку, напишите в Telegram создателю:
          </p>
          <a
            href="https://t.me/sneakerdash_manager"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-ember-400 underline underline-offset-4 transition hover:text-ember-300"
          >
            @sneakerdash_manager
          </a>
        </div>
      </div>
    );
  }

  if (!loading && gate === "deleted") {
    const handleReregister = async () => {
      await api.logout().catch(() => {});
      setGate(null);
      window.location.href = "/register";
    };
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass max-w-sm p-8 text-center">
          <div className="text-4xl">❌</div>
          <h1 className="display mt-4 text-2xl text-ink-50">
            Аккаунт удалён
          </h1>
          <p className="mt-3 text-sm text-ink-200/70">
            Ваш аккаунт был удалён администратором. Зарегистрируйтесь заново и
            не пишите ерунду в анкете.
          </p>
          <button
            type="button"
            onClick={handleReregister}
            className="btn-primary mt-6"
          >
            Зарегистрироваться
          </button>
        </div>
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ me, loading, gate, refresh, logout, setMe }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}

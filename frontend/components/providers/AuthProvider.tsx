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

import { APIError, api } from "@/lib/api";
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

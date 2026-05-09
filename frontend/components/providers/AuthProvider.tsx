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

type AuthCtx = {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
  setMe: (m: Me | null) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/verify-email",
]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setMe(user);
      return user;
    } catch (e) {
      if (e instanceof APIError && e.status === 401) {
        setMe(null);
        return null;
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
    const isPublic = PUBLIC_PATHS.has(pathname) || pathname.startsWith("/verify-email");
    if (!me && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, me, pathname, router]);

  const logout = useCallback(async () => {
    await api.logout();
    setMe(null);
    router.replace("/");
  }, [router]);

  return (
    <Ctx.Provider value={{ me, loading, refresh, logout, setMe }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}

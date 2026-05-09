"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { APIError, api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") || "/swipe";
  const { setMe } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      setMe(res.user);
      router.replace(next);
    } catch (e) {
      if (e instanceof APIError) {
        if (e.status === 401) setError("Неверный email или пароль");
        else if (e.status === 429) setError("Слишком много попыток. Попробуй через 15 минут");
        else if (e.status === 403) setError("Аккаунт заблокирован");
        else setError(e.detail);
      } else {
        setError("Сетевая ошибка");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-ember-gradient"
      />
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10 sm:px-8">
        <Link href="/" className="display text-3xl">
          MATCH<span className="text-ember-400"> 57</span>
        </Link>
        <div className="glass mt-10 p-7">
          <h1 className="display text-3xl">Войти</h1>
          <p className="mt-2 text-sm text-ink-100/70">
            Используй email и пароль, которыми регистрировался.
          </p>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              autoComplete="email"
              required
              placeholder="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              autoComplete="current-password"
              required
              placeholder="пароль"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "..." : "Войти"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-ink-100/70">
            Нет аккаунта?{" "}
            <Link href="/register" className="text-ember-400 hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

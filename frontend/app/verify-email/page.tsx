"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { APIError, api } from "@/lib/api";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <Verify />
    </Suspense>
  );
}

function Verify() {
  const params = useSearchParams();
  const token = params?.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Нет токена в ссылке.");
      return;
    }
    api
      .verifyEmail(token)
      .then(() => {
        setStatus("ok");
        setMessage("Готово! Email подтверждён.");
      })
      .catch((e) => {
        setStatus("error");
        if (e instanceof APIError) setMessage(e.detail);
        else setMessage("Сетевая ошибка");
      });
  }, [token]);

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
        <div className="glass mt-10 p-7 text-center">
          {status === "loading" && (
            <p className="text-ink-100/80">Проверяем токен…</p>
          )}
          {status === "ok" && (
            <>
              <h1 className="display text-3xl">Email подтверждён ✨</h1>
              <p className="mt-3 text-ink-100/70">{message}</p>
              <Link href="/swipe" className="btn-primary mt-6 inline-block">
                Открыть приложение
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <h1 className="display text-3xl">Не получилось</h1>
              <p className="mt-3 text-red-200">{message}</p>
              <Link href="/" className="btn-ghost mt-6 inline-block">
                На главную
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { APIError, api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { me, refresh } = useAuth();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"input" | "loading" | "ok" | "error">("input");
  const [message, setMessage] = useState<string>("");

  async function submit() {
    if (code.length !== 6) return;
    setStatus("loading");
    try {
      await api.verifyEmail(code);
      setStatus("ok");
      setMessage("Готово! Email подтверждён.");
      await refresh();
      setTimeout(() => router.replace("/profile/edit?welcome=1"), 1500);
    } catch (e) {
      setStatus("error");
      if (e instanceof APIError) {
        if (e.detail === "bad_code") setMessage("Неверный код. Проверь и попробуй ещё раз.");
        else if (e.detail === "code_expired") setMessage("Код истёк. Запроси новый.");
        else setMessage(e.detail);
      } else {
        setMessage("Сетевая ошибка");
      }
    }
  }

  async function resend() {
    try {
      await api.resendVerify();
      setMessage("Новый код отправлен на почту!");
      setStatus("input");
      setCode("");
    } catch (e) {
      if (e instanceof APIError) setMessage(e.detail);
    }
  }

  const maskedEmail = me?.email
    ? me.email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(b.length) + c)
    : "твою почту";

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
        <div className="glass mt-10 flex flex-col gap-4 p-7 text-center">
          {status === "ok" ? (
            <>
              <h1 className="display text-3xl">Email подтверждён</h1>
              <p className="text-ink-100/70">{message}</p>
              <p className="text-sm text-ink-200/60 animate-pulse">Перенаправляем…</p>
            </>
          ) : (
            <>
              <h1 className="display text-3xl">Подтверди email</h1>
              <p className="text-sm text-ink-100/70">
                На <span className="font-medium text-ink-50">{maskedEmail}</span> отправлен 6-значный код. Введи его ниже.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="input text-center text-2xl tracking-[0.3em]"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
              />
              {message && (
                <p className={`text-sm ${status === "error" ? "text-red-200" : "text-emerald-200"}`}>
                  {message}
                </p>
              )}
              <button
                className="btn-primary"
                onClick={submit}
                disabled={code.length !== 6 || status === "loading"}
              >
                {status === "loading" ? "Проверяем…" : "Подтвердить"}
              </button>
              <button type="button" className="btn-ghost text-sm" onClick={resend}>
                Отправить код заново
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

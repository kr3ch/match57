"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { APIError, api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";

const CODE_LEN = 6;
const RESEND_SECONDS = 60;

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <Verify />
    </Suspense>
  );
}

function Verify() {
  const params = useSearchParams();
  const initialToken = params?.get("token") ?? "";
  const router = useRouter();
  const { me, refresh } = useAuth();

  const [digits, setDigits] = useState<string[]>(() => {
    const seed = initialToken.replace(/\D/g, "").slice(0, CODE_LEN);
    return Array.from({ length: CODE_LEN }, (_, i) => seed[i] ?? "");
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    initialToken ? "loading" : "idle",
  );
  const [error, setError] = useState<string>("");
  const [resendIn, setResendIn] = useState<number>(0);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");

  // Countdown tick.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const submit = useCallback(
    async (full: string) => {
      setStatus("loading");
      setError("");
      try {
        await api.verifyEmail(full);
        setStatus("ok");
        await refresh().catch(() => {});
        window.setTimeout(() => router.replace("/swipe"), 800);
      } catch (e) {
        setStatus("error");
        if (e instanceof APIError) {
          if (e.detail === "code_expired") setError("Код истёк — запроси новый.");
          else if (e.detail === "too_many_attempts") setError("Слишком много попыток. Попробуй через 10 минут.");
          else setError("Код неверный. Проверь и попробуй ещё раз.");
        } else {
          setError("Сетевая ошибка. Попробуй ещё раз.");
        }
        setDigits(Array(CODE_LEN).fill(""));
        window.setTimeout(() => inputs.current[0]?.focus(), 50);
      }
    },
    [refresh, router],
  );

  // Auto-submit when all 6 digits filled.
  useEffect(() => {
    if (code.length === CODE_LEN && status !== "loading" && status !== "ok") {
      void submit(code);
    }
  }, [code, status, submit]);

  // Focus first cell on mount.
  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const onChange = (i: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "");
    if (!v) {
      setDigits((d) => d.map((x, k) => (k === i ? "" : x)));
      return;
    }
    // If user typed multiple digits at once (e.g. mobile auto-suggest), spread them.
    setDigits((d) => {
      const next = [...d];
      for (let k = 0; k < v.length && i + k < CODE_LEN; k++) {
        next[i + k] = v[k];
      }
      return next;
    });
    const nextIdx = Math.min(i + v.length, CODE_LEN - 1);
    inputs.current[nextIdx]?.focus();
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
      setDigits((d) => d.map((x, k) => (k === i - 1 ? "" : x)));
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < CODE_LEN - 1) {
      inputs.current[i + 1]?.focus();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LEN);
    if (!text) return;
    e.preventDefault();
    setDigits(Array.from({ length: CODE_LEN }, (_, k) => text[k] ?? ""));
    inputs.current[Math.min(text.length, CODE_LEN - 1)]?.focus();
  };

  const resend = async () => {
    if (resendIn > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const r = await api.resendVerify();
      setResendIn(r.resend_in ?? RESEND_SECONDS);
    } catch (e) {
      if (e instanceof APIError) {
        const m = /wait_(\d+)s/.exec(e.detail);
        if (m) setResendIn(parseInt(m[1], 10));
        else setError(e.detail);
      } else {
        setError("Сетевая ошибка");
      }
    } finally {
      setResending(false);
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
          {status === "ok" ? (
            <div className="text-center">
              <div className="display text-3xl">Подтверждено</div>
              <p className="mt-3 text-ink-100/70">
                Email подтверждён. Переносим тебя в приложение…
              </p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="display text-3xl">Подтверди email</div>
                <p className="mt-2 text-sm text-ink-100/70">
                  Мы отправили 6-значный код на{" "}
                  <span className="text-ink-50">{me?.email ?? "твою почту"}</span>.
                  Введи его ниже.
                </p>
              </div>

              <div className="mt-6 flex justify-center gap-2 sm:gap-3">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    pattern="[0-9]*"
                    maxLength={CODE_LEN}
                    value={d}
                    disabled={status === "loading"}
                    onChange={onChange(i)}
                    onKeyDown={onKeyDown(i)}
                    onPaste={onPaste}
                    aria-label={`Цифра ${i + 1}`}
                    className={`h-14 w-11 rounded-2xl border border-white/10 bg-white/5 text-center font-display text-2xl tabular-nums shadow-inner outline-none transition focus:border-ember-400/60 focus:bg-white/10 focus:ring-2 focus:ring-ember-400/30 sm:h-16 sm:w-12 sm:text-3xl ${
                      status === "error" ? "border-rose-400/50 animate-shake" : ""
                    }`}
                  />
                ))}
              </div>

              <div className="mt-5 min-h-[1.25rem] text-center text-sm">
                {status === "loading" && (
                  <span className="text-ink-100/70">Проверяем код…</span>
                )}
                {status === "error" && (
                  <span className="text-rose-300">{error}</span>
                )}
              </div>

              <div className="mt-4 text-center text-xs text-ink-200/60">
                {resendIn > 0 ? (
                  <>Не пришло? Можно запросить ещё раз через {resendIn} сек</>
                ) : (
                  <button
                    type="button"
                    disabled={resending}
                    onClick={resend}
                    className="text-ember-300 underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {resending ? "Отправляем…" : "Отправить код ещё раз"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-200/50">
          Не туда попал? <Link href="/" className="underline">На главную</Link>
        </p>
      </div>
    </main>
  );
}

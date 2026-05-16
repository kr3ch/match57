"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api, APIError } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";

type PinState = "loading" | "ok" | "needed";

/**
 * Wrapper around the whole /admin sub-tree.
 *
 * Two layered checks:
 *   1. ``me.is_admin`` — non-admins are bounced to /swipe.
 *   2. ``GET /api/admin/pin-status`` — if the server requires a PIN and the
 *      user does not yet have a fresh PIN cookie, we render a modal that
 *      blocks the page until they enter the right value (or hit "logout").
 *
 * If the server returns ``required: false`` (no ADMIN_PIN set, e.g. local
 * dev), we transparently render the children with no extra UI.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, refresh } = useAuth();
  const router = useRouter();
  const [pinState, setPinState] = useState<PinState>("loading");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Kick non-admins out.
  useEffect(() => {
    if (!loading && me && !me.is_admin) router.replace("/swipe");
  }, [loading, me, router]);

  // 2. Probe the PIN gate as soon as we know the user is an admin.
  useEffect(() => {
    if (!me?.is_admin) return;
    let cancelled = false;
    api
      .adminPinStatus()
      .then((s) => {
        if (cancelled) return;
        if (!s.required) {
          setPinState("ok");
          return;
        }
        setPinState(s.ok ? "ok" : "needed");
      })
      .catch(() => {
        if (cancelled) return;
        setPinState("needed");
      });
    return () => {
      cancelled = true;
    };
  }, [me?.is_admin]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.adminVerifyPin(pin);
      setPin("");
      setPinState("ok");
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.detail === "bad_pin" ? "Неверный PIN" : err.detail);
      } else {
        setError("Не удалось проверить PIN");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onLock = async () => {
    try {
      await api.adminLock();
    } finally {
      setPinState("needed");
      // Refresh /me in case the server rolled back any admin flag.
      try {
        await refresh?.();
      } catch {
        /* noop */
      }
    }
  };

  // While we don't know yet, render nothing — avoids a flash of the panel.
  if (loading || pinState === "loading") {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <div className="text-sm text-ink-200/70">…</div>
      </main>
    );
  }

  if (pinState === "needed") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-6">
        <form
          onSubmit={onSubmit}
          className="glass flex w-full max-w-sm flex-col gap-4 p-6"
        >
          <div>
            <span className="label">админ доступ</span>
            <h1 className="display text-3xl">Введите PIN</h1>
            <p className="mt-1 text-sm text-ink-100/70">
              PIN истекает по таймеру, после чего его нужно ввести снова.
            </p>
          </div>
          <input
            className="input"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            maxLength={32}
          />
          {error && <div className="text-sm text-rose-300">{error}</div>}
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !pin}
          >
            {submitting ? "проверяем…" : "разблокировать"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onLock}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-200/80 transition hover:bg-white/10"
        >
          закрыть админку
        </button>
      </div>
      {children}
    </div>
  );
}

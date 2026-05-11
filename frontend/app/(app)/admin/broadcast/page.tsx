"use client";

import { useState } from "react";
import Link from "next/link";

import { APIError, api } from "@/lib/api";
import { useNotifications } from "@/components/providers/NotificationProvider";

const LIMIT = 1000;

export default function AdminBroadcastPage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { push } = useNotifications();
  const trimmed = text.trim();
  const over = trimmed.length > LIMIT;

  return (
    <main className="flex flex-col gap-4">
      <header>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-ink-100/60 transition hover:text-ink-100"
        >
          ← Назад
        </Link>
        <h1 className="display mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Рассылка
        </h1>
      </header>

      <p className="text-sm text-ink-100/70">
        Сообщение появится в чатах всех пользователей как системное.
        Отправителем будет твой админ-аккаунт.
      </p>

      <div className="glass-soft p-3">
        <textarea
          className="input min-h-48 !bg-transparent !ring-0"
          placeholder="Текст рассылки…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-1 flex items-center justify-between px-2 text-[11px] text-ink-100/50">
          <span>{trimmed ? "Поддерживается markdown-like форматирование" : "Минимум 1 символ"}</span>
          <span
            className={`tabular-nums ${
              over ? "text-rose-300" : "text-ink-100/50"
            }`}
          >
            {trimmed.length}/{LIMIT}
          </span>
        </div>
      </div>

      <button
        type="button"
        disabled={busy || !trimmed || over}
        onClick={async () => {
          if (!confirm("Отправить рассылку всем?")) return;
          setBusy(true);
          try {
            const r = await api.adminBroadcast(trimmed);
            push({
              title: "Рассылка отправлена",
              body: `Доставлено: ${r.sent}`,
            });
            setText("");
          } catch (e) {
            if (e instanceof APIError) push({ title: "Ошибка", body: e.detail });
          } finally {
            setBusy(false);
          }
        }}
        className="btn-primary inline-flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            Отправляем…
          </>
        ) : (
          <>Разослать</>
        )}
      </button>
    </main>
  );
}

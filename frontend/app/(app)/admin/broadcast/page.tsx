"use client";

import { useState } from "react";
import Link from "next/link";

import { APIError, api } from "@/lib/api";
import { useNotifications } from "@/components/providers/NotificationProvider";

export default function AdminBroadcastPage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { push } = useNotifications();

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">рассылка</h1>
        <Link href="/admin" className="btn-ghost">
          ← назад
        </Link>
      </header>

      <p className="text-sm text-ink-100/70">
        Сообщение появится в чатах всех пользователей как системное —
        отправителем будет твой админ-аккаунт.
      </p>

      <textarea
        className="input min-h-48"
        placeholder="Текст рассылки…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || !text.trim()}
        onClick={async () => {
          if (!confirm("Отправить рассылку всем?")) return;
          setBusy(true);
          try {
            const r = await api.adminBroadcast(text.trim());
            push({
              title: "Рассылка отправлена",
              body: `доставлено: ${r.sent}`,
            });
            setText("");
          } catch (e) {
            if (e instanceof APIError) push({ title: "Ошибка", body: e.detail });
          } finally {
            setBusy(false);
          }
        }}
        className="btn-primary"
      >
        {busy ? "Шлём…" : "разослать"}
      </button>
    </main>
  );
}

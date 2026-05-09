"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { toast } from "@/components/Toaster";

export default function AdminBroadcastPage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">рассылка</h1>
        <Link href="/admin" className="btn-ghost">
          ← назад
        </Link>
      </header>

      <p className="text-sm text-ink-100/70">
        Сообщение приходит в Telegram всем зарегистрированным. Будет видно от
        имени бота с пометкой «📢 от администрации».
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
            toast({
              title: "Рассылка отправлена",
              body: `доставлено: ${r.sent}, ошибок: ${r.failed}`,
            });
            setText("");
          } catch (e) {
            toast({
              title: "Ошибка",
              body: (e as Error).message,
              tone: "error",
            });
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

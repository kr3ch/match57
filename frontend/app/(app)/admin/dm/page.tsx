"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { toast } from "@/components/Toaster";

export default function AdminDMPage() {
  const [userId, setUserId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">сообщение пользователю</h1>
        <Link href="/admin" className="btn-ghost">
          ← назад
        </Link>
      </header>

      <input
        className="input"
        placeholder="Telegram user ID"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />
      <textarea
        className="input min-h-40"
        placeholder="Текст сообщения…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || !userId.trim() || !text.trim()}
        className="btn-primary disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api.adminDM(Number(userId), text.trim());
            toast({
              title: r.delivered ? "Доставлено" : "Не доставлено",
              tone: r.delivered ? "default" : "error",
            });
            if (r.delivered) {
              setUserId("");
              setText("");
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        отправить
      </button>
    </main>
  );
}

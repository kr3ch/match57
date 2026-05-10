"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { APIError, api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { useNotifications } from "@/components/providers/NotificationProvider";
import type { Me } from "@/lib/types";

export default function AdminUserDetailPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = Number(sp.get("id") ?? "");
  const { push } = useNotifications();
  const [profile, setProfile] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // We don't have a single-user admin endpoint — fall back to listing search.
    api
      .adminUsers(String(id))
      .then(({ items }) => {
        const found = items.find((u) => u.user_id === id) ?? items[0] ?? null;
        setProfile(found);
      })
      .catch((e) => {
        if (e instanceof APIError) push({ title: "Не найдено", body: e.detail });
      });
  }, [id, push]);

  if (!profile) return <p className="text-ink-200/60">Грузим…</p>;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-baseline justify-between">
        <Link href="/admin/users" className="btn-ghost">
          ← к списку
        </Link>
        <span className="label">id: {profile.user_id}</span>
      </header>

      <div className="glass overflow-hidden p-3">
        <div className="grid grid-cols-3 gap-2">
          {profile.photos.map((p) => (
            <div
              key={p.id}
              className="aspect-[3/4] overflow-hidden rounded-2xl bg-ink-700/40"
            >
              {p.kind === "video" ? (
                <video
                  src={mediaUrl(p.user_id, p.filename)}
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(p.user_id, p.filename)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div className="display text-3xl">
            {profile.name}, {profile.age}
          </div>
          <div className="text-sm text-ink-200/70">
            {profile.gender} · ищет {profile.looking_for.toLowerCase()}
          </div>
        </div>
        <div className="mt-1 text-xs text-ink-200/60">
          {profile.email} {profile.username ? `· @${profile.username}` : null}
        </div>
        {profile.description ? (
          <p className="mt-3 text-ink-100/85">{profile.description}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {profile.banned ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.adminUnban(profile.user_id);
                push({ title: "Разбанен" });
                setProfile({ ...profile, banned: false });
              } finally {
                setBusy(false);
              }
            }}
          >
            ↩ разбан
          </button>
        ) : (
          <button
            type="button"
            className="btn-ghost text-rose-200"
            disabled={busy}
            onClick={async () => {
              if (!confirm("Забанить?")) return;
              setBusy(true);
              try {
                await api.adminBan(profile.user_id);
                push({ title: "Забанен" });
                setProfile({ ...profile, banned: true });
              } finally {
                setBusy(false);
              }
            }}
          >
            🚫 забанить
          </button>
        )}
        <button
          type="button"
          className="btn-rose"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Удалить анкету полностью? Это необратимо.")) return;
            setBusy(true);
            try {
              await api.adminDeleteUser(profile.user_id);
              push({ title: "Анкета удалена" });
              router.push("/admin/users");
            } finally {
              setBusy(false);
            }
          }}
        >
          🗑 удалить
        </button>
      </div>
    </main>
  );
}

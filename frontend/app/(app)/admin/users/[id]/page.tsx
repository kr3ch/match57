"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { toast } from "@/components/Toaster";
import { Modal } from "@/components/Modal";
import type { Profile } from "@/lib/types";

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [profile, setProfile] = useState<(Profile & { banned: boolean }) | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [dmText, setDmText] = useState("");

  useEffect(() => {
    api.adminUser(id).then(setProfile).catch((e) => {
      toast({ title: "Не найдено", body: e.message, tone: "error" });
    });
  }, [id]);

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
          {profile.photos.map((p, i) => (
            <div
              key={i}
              className="aspect-[3/4] overflow-hidden rounded-2xl bg-ink-700/40"
            >
              {p.type === "video" ? (
                <video
                  src={mediaUrl(p.file_id)}
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(p.file_id)}
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
        {profile.username ? (
          <a
            className="text-sm text-ember-300 underline"
            target="_blank"
            rel="noreferrer"
            href={`https://t.me/${profile.username}`}
          >
            @{profile.username}
          </a>
        ) : null}
        {profile.description ? (
          <p className="mt-3 text-ink-100/85">{profile.description}</p>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat k="лайков" v={profile.likes_received?.length ?? 0} />
        <Stat k="отправил" v={profile.likes_sent?.length ?? 0} />
        <Stat k="мэтчей" v={profile.matches?.length ?? 0} />
        <Stat k="приглашено" v={profile.referrals?.length ?? 0} />
      </ul>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setDmOpen(true)}
        >
          📩 написать
        </button>
        {profile.banned ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.adminUnban(profile.user_id);
                toast({ title: "Разбанен" });
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
                toast({ title: "Забанен" });
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
              await api.adminDelete(profile.user_id);
              toast({ title: "Анкета удалена" });
              router.push("/admin/users");
            } finally {
              setBusy(false);
            }
          }}
        >
          ✕ удалить
        </button>
      </div>

      <Modal
        open={dmOpen}
        onClose={() => setDmOpen(false)}
        title={`Сообщение для ${profile.name}`}
      >
        <textarea
          className="input min-h-32"
          value={dmText}
          onChange={(e) => setDmText(e.target.value)}
          placeholder="Текст сообщения…"
        />
        <button
          type="button"
          className="btn-primary mt-3 w-full disabled:opacity-50"
          disabled={!dmText.trim() || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api.adminDM(profile.user_id, dmText.trim());
              toast({
                title: r.delivered ? "Доставлено" : "Не дошло",
                tone: r.delivered ? "default" : "error",
              });
              setDmOpen(false);
              setDmText("");
            } finally {
              setBusy(false);
            }
          }}
        >
          отправить
        </button>
      </Modal>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <li className="glass-soft px-4 py-3">
      <div className="display text-2xl">{v}</div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-ink-200/70">
        {k}
      </div>
    </li>
  );
}

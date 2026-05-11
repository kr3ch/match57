"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { APIError, api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { useNotifications } from "@/components/providers/NotificationProvider";
import type { Me } from "@/lib/types";

export default function EditProfilePage() {
  return (
    <Suspense fallback={null}>
      <EditProfile />
    </Suspense>
  );
}

function EditProfile() {
  const params = useSearchParams();
  const welcome = params?.get("welcome") === "1";
  const { push } = useNotifications();
  const [profile, setProfile] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState<number>(16);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.myProfile().then((p) => {
      setProfile(p.profile);
      setName(p.profile.name);
      setDescription(p.profile.description ?? "");
      setPhone(p.profile.phone ?? "");
      setAge(p.profile.age);
    });
  }, []);

  if (!profile) return <p className="text-ink-200/60">Грузим…</p>;

  async function save() {
    setBusy(true);
    try {
      const r = await api.updateProfile({
        name: name.trim() || undefined,
        description: description.trim(),
        phone: phone.trim(),
        age,
      });
      setProfile(r.profile);
      push({ title: "Сохранено" });
    } catch (e) {
      if (e instanceof APIError) push({ title: "Ошибка", body: e.detail });
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    setBusy(true);
    try {
      const r = await api.addPhoto(file);
      setProfile(r.profile);
    } catch (e) {
      if (e instanceof APIError) push({ title: "Не загрузилось", body: e.detail });
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(photoId: number) {
    setBusy(true);
    try {
      const r = await api.deletePhoto(photoId);
      setProfile(r.profile);
    } catch (e) {
      if (e instanceof APIError) push({ title: "Ошибка", body: e.detail });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">
          {welcome ? "финальный штрих" : "правки"}
        </h1>
        {profile.photos.length > 0 ? (
          <Link href="/profile" className="btn-ghost">
            ← назад
          </Link>
        ) : null}
      </header>

      {profile.photos.length === 0 && (
        <p className="glass-soft px-5 py-4 text-sm text-amber-200">
          Загрузи хотя бы одно фото — это обязательно для использования приложения.
        </p>
      )}

      <section className="glass flex flex-col gap-3 p-5">
        <h2 className="display text-2xl">фото и видео</h2>
        <p className="text-xs text-ink-200/60">До 3 файлов · фото или короткое видео</p>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => {
            const p = profile.photos[i];
            return (
              <div
                key={i}
                className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/5"
              >
                {p ? (
                  <>
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
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
                      onClick={() => void removePhoto(p.id)}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs text-ink-200/60">
                    <span className="text-2xl">＋</span>
                    добавить
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        await uploadFile(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass flex flex-col gap-3 p-5">
        <h2 className="display text-2xl">данные</h2>
        <label className="text-xs text-ink-200/70">имя</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 50))}
        />
        <label className="text-xs text-ink-200/70">возраст</label>
        <input
          type="number"
          min={14}
          max={100}
          className="input"
          value={age}
          onChange={(e) => setAge(Number(e.target.value) || 14)}
        />
        <label className="text-xs text-ink-200/70">описание</label>
        <textarea
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          className="input min-h-32"
        />
        <label className="text-xs text-ink-200/70">телефон (видят только мэтчи)</label>
        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value.slice(0, 30))}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-200/60">
            {description.length} / 500
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="btn-primary"
          >
            сохранить
          </button>
        </div>
      </section>

      {welcome && profile.photos.length > 0 && (
        <Link href="/swipe" className="btn-primary text-center">
          Поехали свайпать →
        </Link>
      )}
    </main>
  );
}

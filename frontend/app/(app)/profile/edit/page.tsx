"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { APIError, api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import type { LookingFor, Me } from "@/lib/types";

const LOOKING_FOR_OPTIONS: { value: LookingFor; label: string }[] = [
  { value: "Парни", label: "Парни" },
  { value: "Девушки", label: "Девушки" },
  { value: "Все равно", label: "Все равно" },
];

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
  const { refresh: refreshAuth } = useAuth();
  const [profile, setProfile] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState<number>(16);
  const [lookingFor, setLookingFor] = useState<LookingFor>("Все равно");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.myProfile().then((p) => {
      setProfile(p.profile);
      setName(p.profile.name);
      setDescription(p.profile.description ?? "");
      setPhone(p.profile.phone ?? "");
      setAge(p.profile.age);
      setLookingFor(p.profile.looking_for);
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
        looking_for: lookingFor,
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
    if (file.type.startsWith("video/")) {
      const ok = await new Promise<boolean>((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(v.src);
          if (v.duration > 30) {
            push({ title: "Слишком длинное", body: "Видео должно быть не дольше 30 секунд" });
            resolve(false);
          } else {
            resolve(true);
          }
        };
        v.onerror = () => { URL.revokeObjectURL(v.src); resolve(true); };
        v.src = URL.createObjectURL(file);
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await api.addPhoto(file);
      setProfile(r.profile);
      await refreshAuth();
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
      await refreshAuth();
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
        <div className="glass flex items-start gap-3 border border-amber-300/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          <span aria-hidden="true" className="text-xl leading-none">⚠️</span>
          <div className="flex flex-col gap-1">
            <strong className="display text-base text-amber-50">
              Добавь фото — без него ничего не работает
            </strong>
            <span className="text-amber-100/85">
              Профиль без фото не появится в ленте, нельзя лайкать и матчиться.
              Подойдёт обычное селфи или короткое видео — до 3 файлов.
            </span>
          </div>
        </div>
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
        <label className="text-xs text-ink-200/70">кого ищу</label>
        <div
          role="radiogroup"
          aria-label="Кого ищу"
          className="grid grid-cols-3 gap-2"
        >
          {LOOKING_FOR_OPTIONS.map((opt) => {
            const active = lookingFor === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setLookingFor(opt.value)}
                className={`rounded-2xl border px-3 py-2 text-sm transition ${
                  active
                    ? "border-ember-400/70 bg-ember-500/20 text-ink-50"
                    : "border-white/10 bg-white/[0.03] text-ink-200/80 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
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

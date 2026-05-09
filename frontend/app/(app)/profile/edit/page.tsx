"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { toast } from "@/components/Toaster";
import type { PhotoMedia, Profile } from "@/lib/types";

export default function EditProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PhotoMedia[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.myProfile().then((p) => {
      setProfile(p);
      setDescription(p.description ?? "");
      setPhotos(p.photos ?? []);
    });
  }, []);

  if (!profile) return <p className="text-ink-200/60">Грузим…</p>;

  async function saveDescription() {
    setBusy(true);
    try {
      const updated = await api.updateDescription(description);
      setProfile(updated);
      toast({ title: "Описание сохранено" });
    } catch (e) {
      toast({ title: "Ошибка", body: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File, kind: "photo" | "video") {
    setBusy(true);
    try {
      const r = await api.uploadPhoto(file, kind);
      setPhotos((arr) => [...arr, r].slice(0, 3));
    } catch (e) {
      toast({ title: "Не загрузилось", body: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function savePhotos() {
    setBusy(true);
    try {
      const updated = await api.replacePhotos(photos);
      setProfile(updated);
      toast({ title: "Фото обновлены" });
    } catch (e) {
      toast({ title: "Ошибка", body: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-4xl">правки</h1>
        <Link href="/profile" className="btn-ghost">
          ← назад
        </Link>
      </header>

      <section className="glass flex flex-col gap-3 p-5">
        <h2 className="display text-2xl">описание</h2>
        <textarea
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
          className="input min-h-40"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-200/60">
            {description.length} / 2000
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={saveDescription}
            className="btn-primary"
          >
            сохранить
          </button>
        </div>
      </section>

      <section className="glass flex flex-col gap-3 p-5">
        <h2 className="display text-2xl">фото и видео</h2>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => {
            const p = photos[i];
            return (
              <div
                key={i}
                className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/5"
              >
                {p ? (
                  <>
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
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
                      onClick={() =>
                        setPhotos((arr) => arr.filter((_, idx) => idx !== i))
                      }
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
                        await uploadFile(
                          f,
                          f.type.startsWith("video") ? "video" : "photo",
                        );
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          disabled={busy || photos.length === 0}
          className="btn-primary self-end disabled:opacity-50"
          onClick={savePhotos}
        >
          применить фото
        </button>
      </section>
    </main>
  );
}

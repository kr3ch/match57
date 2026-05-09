"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { mediaUrl } from "@/lib/media";
import { toast } from "@/components/Toaster";
import type {
  Gender,
  LookingFor,
  PhotoMedia,
} from "@/lib/types";

type Step =
  | "agreement"
  | "privacy"
  | "age"
  | "gender"
  | "looking_for"
  | "name"
  | "description"
  | "photos"
  | "phone"
  | "review";

const ORDER: Step[] = [
  "agreement",
  "privacy",
  "age",
  "gender",
  "looking_for",
  "name",
  "description",
  "photos",
  "phone",
  "review",
];

export default function RegisterPage() {
  const { me, loading, refresh } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("agreement");
  const [age, setAge] = useState<number>(16);
  const [gender, setGender] = useState<Gender | null>(null);
  const [lookingFor, setLookingFor] = useState<LookingFor | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PhotoMedia[]>([]);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace("/");
    else if (me.registered) router.replace("/swipe");
  }, [loading, me, router]);

  const idx = ORDER.indexOf(step);
  const next = () => setStep(ORDER[Math.min(idx + 1, ORDER.length - 1)]);
  const back = () => setStep(ORDER[Math.max(idx - 1, 0)]);

  const canProceed = useMemo(() => {
    if (step === "age") return age >= 14 && age <= 100;
    if (step === "gender") return !!gender;
    if (step === "looking_for") return !!lookingFor;
    if (step === "name") return name.trim().length > 0;
    if (step === "photos") return photos.length > 0;
    if (step === "phone") return phone.trim().length >= 3;
    return true;
  }, [step, age, gender, lookingFor, name, photos, phone]);

  async function uploadFile(file: File, kind: "photo" | "video") {
    setUploading(true);
    try {
      const r = await api.uploadPhoto(file, kind);
      setPhotos((p) => [...p, r].slice(0, 3));
    } catch (e) {
      toast({ title: "Загрузка не удалась", body: (e as Error).message, tone: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!gender || !lookingFor) return;
    setSubmitting(true);
    try {
      await api.register({
        age,
        gender,
        looking_for: lookingFor,
        name: name.trim(),
        description: description.trim(),
        photos,
        phone: phone.trim(),
      } as never);
      await refresh();
      toast({ title: "Анкета готова", body: "Поехали свайпать." });
      router.replace("/swipe");
    } catch (e) {
      toast({ title: "Не удалось сохранить", body: (e as Error).message, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-5 pb-24 pt-8 sm:pt-16">
      <header>
        <span className="pill">шаг {idx + 1} / {ORDER.length}</span>
        <div className="mt-3 flex h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full bg-ember-500"
            initial={{ width: 0 }}
            animate={{ width: `${((idx + 1) / ORDER.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.section
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-1 flex-col gap-5"
        >
          {step === "agreement" && (
            <Step
              title="Привет."
              kicker="у нас тут пара правил"
              text="Тебе должно быть от 14 лет, ты учишься (или учился) в 57-й, и ты будешь вести себя по-человечески. Нарушаешь — баним без объяснений."
            >
              <Choices
                options={[
                  { id: "ok", label: "Понятно" },
                  { id: "no", label: "Нет, я не из 57", danger: true },
                ]}
                onSelect={(id) => {
                  if (id === "no") {
                    toast({ title: "Тогда тебе сюда не надо :)", tone: "error" });
                    return;
                  }
                  next();
                }}
              />
            </Step>
          )}

          {step === "privacy" && (
            <Step
              title="Что будет видно?"
              kicker="спойлер: только то, что ты сам напишешь"
              text="Имя, возраст, до 3 фото и пара слов о себе. Username и Telegram-ID ты не отдаёшь напрямую — мы сами свяжем вас при взаимной симпатии."
            >
              <Choices
                options={[
                  { id: "ok", label: "Окей, дальше →" },
                  { id: "skip", label: "Без меня", danger: true },
                ]}
                onSelect={(id) => (id === "ok" ? next() : router.replace("/"))}
              />
            </Step>
          )}

          {step === "age" && (
            <Step title="Сколько тебе?" kicker="14–100, всё честно">
              <input
                type="number"
                min={14}
                max={100}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="input text-center text-3xl"
              />
            </Step>
          )}

          {step === "gender" && (
            <Step title="Ты —" kicker="мы не запоминаем больше нужного">
              <Choices
                options={[
                  { id: "Парень", label: "Парень" },
                  { id: "Девушка", label: "Девушка" },
                ]}
                onSelect={(id) => {
                  setGender(id as Gender);
                  next();
                }}
                selected={gender ?? undefined}
              />
            </Step>
          )}

          {step === "looking_for" && (
            <Step title="Ищу" kicker="свайпы будут отфильтрованы">
              <Choices
                options={[
                  { id: "Девушки", label: "Девушек" },
                  { id: "Парни", label: "Парней" },
                  { id: "Все равно", label: "Всё равно" },
                ]}
                onSelect={(id) => {
                  setLookingFor(id as LookingFor);
                  next();
                }}
                selected={lookingFor ?? undefined}
              />
            </Step>
          )}

          {step === "name" && (
            <Step title="Как тебя зовут?" kicker="можно настоящее, можно никнейм">
              <input
                value={name}
                maxLength={64}
                onChange={(e) => setName(e.target.value)}
                placeholder="Лиза"
                className="input"
                autoFocus
              />
            </Step>
          )}

          {step === "description" && (
            <Step title="Расскажи о себе" kicker="что-то весёлое или серьёзное — твой выбор">
              <textarea
                value={description}
                maxLength={2000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Учусь в 11-Б, играю в шахматы и пеку медовик. Ищу того, кто умеет смеяться и не боится клавы…"
                className="input min-h-40"
              />
              <div className="text-right text-xs text-ink-200/60">
                {description.length} / 2000
              </div>
            </Step>
          )}

          {step === "photos" && (
            <Step
              title="До 3 фото или одно видео"
              kicker="без скринов и пейзажей"
            >
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => {
                  const p = photos[i];
                  return (
                    <div
                      key={i}
                      className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/5"
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
              {uploading ? (
                <p className="text-sm text-ink-100/80">Загружаем в Telegram…</p>
              ) : null}
            </Step>
          )}

          {step === "phone" && (
            <Step
              title="Контакт"
              kicker="увидят только при взаимной симпатии"
              text="Можно ввести Telegram-username или номер. Это покажется матчу как «как со мной связаться»."
            >
              <input
                value={phone}
                maxLength={32}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="@username или +7 ..."
                className="input"
              />
            </Step>
          )}

          {step === "review" && (
            <Step
              title="Готово?"
              kicker="всё можно поменять потом"
              text=""
            >
              <div className="glass-soft space-y-2 px-4 py-4 text-sm">
                <Row k="Возраст" v={String(age)} />
                <Row k="Пол" v={gender ?? "?"} />
                <Row k="Ищет" v={lookingFor ?? "?"} />
                <Row k="Имя" v={name} />
                <Row k="Описание" v={description || "—"} />
                <Row k="Фото" v={`${photos.length} шт.`} />
                <Row k="Контакт" v={phone} />
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? "Сохраняем…" : "Опубликовать анкету"}
              </button>
            </Step>
          )}
        </motion.section>
      </AnimatePresence>

      <nav className="mt-auto flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={back}
          disabled={idx === 0}
          className="btn-ghost disabled:opacity-30"
        >
          ← назад
        </button>
        {step !== "review" && step !== "agreement" && step !== "privacy" && (
          <button
            type="button"
            onClick={next}
            disabled={!canProceed}
            className="btn-primary disabled:opacity-40"
          >
            дальше →
          </button>
        )}
      </nav>
    </main>
  );
}

function Step({
  title,
  kicker,
  text,
  children,
}: {
  title: string;
  kicker?: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {kicker ? <span className="label">{kicker}</span> : null}
      <h2 className="display text-balance text-4xl leading-tight sm:text-5xl">
        {title}
      </h2>
      {text ? <p className="text-ink-100/80">{text}</p> : null}
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Choices({
  options,
  onSelect,
  selected,
}: {
  options: { id: string; label: string; danger?: boolean }[];
  onSelect: (id: string) => void;
  selected?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onSelect(o.id)}
          className={`btn-ghost justify-between ${
            selected === o.id ? "border-ember-400/60 bg-ember-500/10" : ""
          } ${o.danger ? "border-rose-300/30 text-rose-200" : ""}`}
        >
          <span>{o.label}</span>
          <span className="opacity-60">→</span>
        </button>
      ))}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label">{k}</span>
      <span className="text-right text-ink-50">{v}</span>
    </div>
  );
}

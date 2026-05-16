"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

import { APIError, api, type RegisterPayload } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Gender, LookingFor } from "@/lib/types";

type Step =
  | "agreement"
  | "credentials"
  | "name"
  | "age"
  | "gender"
  | "looking_for"
  | "description"
  | "review";

const ORDER: Step[] = [
  "agreement",
  "credentials",
  "name",
  "age",
  "gender",
  "looking_for",
  "description",
  "review",
];

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterWizard />
    </Suspense>
  );
}

function RegisterWizard() {
  const { me, loading, setMe } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("agreement");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState<number>(16);
  const [gender, setGender] = useState<Gender | null>(null);
  const [lookingFor, setLookingFor] = useState<LookingFor | null>(null);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (me) router.replace("/swipe");
  }, [loading, me, router]);

  const idx = ORDER.indexOf(step);
  const next = () => setStep(ORDER[Math.min(idx + 1, ORDER.length - 1)]);
  const back = () => setStep(ORDER[Math.max(idx - 1, 0)]);

  const passwordErrors = useMemo(() => {
    const errs: string[] = [];
    if (password.length < 6) errs.push("минимум 6 символов");
    if (!/[A-ZА-ЯЁ]/.test(password)) errs.push("заглавная буква");
    if (!/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?`~]/.test(password)) errs.push("спецсимвол (!@#$…)");
    return errs;
  }, [password]);

  const canProceed = useMemo(() => {
    if (step === "credentials")
      return username.trim().length > 0 && passwordErrors.length === 0;
    if (step === "name") return name.trim().length > 0;
    if (step === "age") return age >= 14 && age <= 100;
    if (step === "gender") return !!gender;
    if (step === "looking_for") return !!lookingFor;
    return true;
  }, [step, username, passwordErrors, name, age, gender, lookingFor]);

  async function submit() {
    if (!gender || !lookingFor) return;
    setError(null);
    setSubmitting(true);
    const payload: RegisterPayload = {
      username: username.trim(),
      password,
      name: name.trim(),
      age,
      gender,
      looking_for: lookingFor,
      description: description.trim() || undefined,
      phone: phone.trim() || undefined,
    };
    try {
      const res = await api.register(payload);
      setMe(res.user);
      router.replace("/profile/edit?welcome=1");
    } catch (e) {
      if (e instanceof APIError) {
        if (e.status === 409 && e.detail === "username_taken")
          setError("Это имя пользователя занято");
        else setError(e.detail);
      } else {
        setError("Сетевая ошибка");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-5 pb-24 pt-8 sm:pt-16">
      <Link href="/" className="display text-2xl">
        MATCH<span className="text-ember-400"> 57</span>
      </Link>
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
              <div className="flex flex-col gap-3 sm:flex-row">
                <button className="btn-primary" onClick={next}>
                  Понятно, продолжить
                </button>
                <Link href="/" className="btn-ghost">
                  Передумал
                </Link>
              </div>
            </Step>
          )}

          {step === "credentials" && (
            <Step
              title="Логин и пароль"
              kicker="как ты будешь входить"
              text="Придумай логин (латиница, цифры, _) и пароль."
            >
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  autoComplete="username"
                  className="input"
                  placeholder="логин"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "")
                        .slice(0, 32),
                    )
                  }
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  className="input"
                  placeholder="пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {password.length > 0 && passwordErrors.length > 0 && (
                  <p className="text-xs text-amber-200/80">
                    Нужно: {passwordErrors.join(", ")}
                  </p>
                )}
                <Nav back={back} next={next} canProceed={canProceed} />
              </div>
            </Step>
          )}

          {step === "name" && (
            <Step title="Как тебя зовут?" kicker="имя или ник">
              <div className="flex flex-col gap-3">
                <input
                  className="input"
                  placeholder="имя"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 50))}
                />
                <Nav back={back} next={next} canProceed={canProceed} />
              </div>
            </Step>
          )}

          {step === "age" && (
            <Step
              title="Сколько тебе лет?"
              kicker="от 14 до 100 лет"
              text="Регистрация только с 14 лет."
            >
              <div className="flex flex-col gap-3">
                <input
                  type="number"
                  min={14}
                  max={100}
                  className="input"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value) || 14)}
                />
                {age < 14 && (
                  <p className="text-xs text-amber-200/80">Минимум 14 лет.</p>
                )}
                {age > 100 && (
                  <p className="text-xs text-amber-200/80">Максимум 100 лет.</p>
                )}
                <Nav back={back} next={next} canProceed={canProceed} />
              </div>
            </Step>
          )}

          {step === "gender" && (
            <Step title="Ты…" kicker="один тап">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["Парень", "Девушка"] as Gender[]).map((g) => (
                  <button
                    key={g}
                    className={`glass-soft p-6 text-lg ${gender === g ? "ring-2 ring-ember-500" : ""}`}
                    onClick={() => {
                      setGender(g);
                      next();
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <Nav back={back} next={next} canProceed={canProceed} />
            </Step>
          )}

          {step === "looking_for" && (
            <Step title="Кого ищешь?">
              <div className="grid gap-3 sm:grid-cols-3">
                {(["Парни", "Девушки", "Все равно"] as LookingFor[]).map((g) => (
                  <button
                    key={g}
                    className={`glass-soft p-6 text-lg ${lookingFor === g ? "ring-2 ring-ember-500" : ""}`}
                    onClick={() => {
                      setLookingFor(g);
                      next();
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <Nav back={back} next={next} canProceed={canProceed} />
            </Step>
          )}

          {step === "description" && (
            <Step title="Расскажи о себе" kicker="можно пропустить">
              <div className="flex flex-col gap-3">
                <textarea
                  className="input min-h-[120px]"
                  placeholder="что любишь, чем занимаешься, что ищешь…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                />
                <input
                  className="input"
                  placeholder="телефон (опционально, видят только мэтчи)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.slice(0, 30))}
                />
                <Nav back={back} next={next} canProceed={canProceed} />
              </div>
            </Step>
          )}

          {step === "review" && (
            <Step title="Готово?" kicker="последний взгляд">
              <div className="glass-soft mt-2 grid gap-2 p-5 text-sm">
                <Row k="логин" v={`@${username}`} />
                <Row k="имя" v={name} />
                <Row k="возраст" v={String(age)} />
                <Row k="пол" v={gender || "—"} />
                <Row k="ищу" v={lookingFor || "—"} />
                {description && <Row k="о себе" v={description} />}
                {phone && <Row k="телефон" v={phone} />}
              </div>
              {error && (
                <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}
              <div className="flex gap-3">
                <button className="btn-ghost flex-1" onClick={back} type="button">
                  Назад
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={submit}
                  disabled={submitting}
                >
                  {submitting ? "Сохраняем…" : "Зарегистрироваться"}
                </button>
              </div>
              <p className="mt-2 rounded-xl bg-amber-500/15 px-3 py-2 text-center text-xs text-amber-200">
                Сразу после регистрации — добавь фото. Без фото профиль
                <strong className="text-amber-100"> не появится в ленте</strong>{" "}
                и не сможет лайкать.
              </p>
            </Step>
          )}
        </motion.section>
      </AnimatePresence>
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
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      {kicker && <span className="label">{kicker}</span>}
      <h2 className="display text-3xl sm:text-5xl">{title}</h2>
      {text && <p className="text-ink-100/80">{text}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Nav({
  back,
  next,
  canProceed,
}: {
  back: () => void;
  next: () => void;
  canProceed: boolean;
}) {
  return (
    <div className="flex gap-3">
      <button className="btn-ghost flex-1" onClick={back} type="button">
        Назад
      </button>
      <button
        className="btn-primary flex-1"
        onClick={next}
        disabled={!canProceed}
        type="button"
      >
        Далее
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/5 py-1.5 last:border-0">
      <span className="text-ink-100/60">{k}</span>
      <span className="truncate text-right">{v}</span>
    </div>
  );
}

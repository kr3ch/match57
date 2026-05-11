"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/components/providers/AuthProvider";

export default function Landing() {
  return (
    <Suspense fallback={null}>
      <LandingContent />
    </Suspense>
  );
}

function LandingContent() {
  const { me } = useAuth();
  const params = useSearchParams();
  const ref = params?.get("ref");
  const refQs = ref ? `?ref=${encodeURIComponent(ref)}` : "";

  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.04] bg-ink-950/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="display text-xl font-semibold tracking-tight">
            MATCH<span className="text-ember-400"> 57</span>
          </div>
          <nav className="flex items-center gap-2">
            {me ? (
              <Link href="/swipe" className="btn-primary !py-2 !px-4 text-sm">
                Открыть →
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden text-sm text-ink-100/80 transition hover:text-ink-50 sm:inline">
                  Войти
                </Link>
                <Link href={`/register${refQs}`} className="btn-primary !py-2 !px-4 text-sm">
                  Регистрация
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-24">
        <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr] md:gap-16">
          <div className="relative z-10">
            <span className="pill mb-7 inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-ember-400" />
              школа №57 · beta
            </span>
            <h1 className="display text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.02em] sm:text-6xl md:text-7xl">
              Найди своих<br />
              в <span className="text-ember-400">57-й</span>.
            </h1>
            <p className="mt-6 max-w-md text-base text-ink-100/70 sm:text-lg">
              Анкеты, лайки, мэтчи и встроенный мессенджер.
              Только своя школа, без чужих и без Telegram.
            </p>

            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row">
              {me ? (
                <Link href="/swipe" className="btn-primary text-base">
                  Свайпать →
                </Link>
              ) : (
                <>
                  <Link href={`/register${refQs}`} className="btn-primary text-base">
                    Зарегистрироваться
                  </Link>
                  <Link href="/login" className="btn-ghost text-base">
                    Войти
                  </Link>
                </>
              )}
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-200/60">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-ember-400" />
                14+ · only school
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-ember-400" />
                голос · видео · реакции
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-ember-400" />
                no Telegram required
              </span>
            </div>
          </div>

          <PhoneMockup />
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto mt-20 max-w-6xl px-5 sm:mt-28 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { v: "1957", l: "школа №57" },
            { v: "100%", l: "только свои" },
            { v: "14+", l: "verified email" },
          ].map((s) => (
            <div
              key={s.l}
              className="glass-soft flex items-baseline justify-between px-6 py-5 sm:flex-col sm:items-start sm:gap-1 sm:py-7"
            >
              <span className="display text-3xl font-semibold tracking-tight sm:text-5xl">
                {s.v}
              </span>
              <span className="text-sm text-ink-100/60">{s.l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
        <h2 className="display text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-5xl">
          Три экрана — и ты внутри.
        </h2>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Регистрация",
              text: "Email, пароль, до 3 фото или видео. Подтверждение через 6-значный код. Минута и всё.",
            },
            {
              n: "02",
              title: "Свайп",
              text: "Жест влево/вправо или клавиатура. Лайк — и другой видит уведомление. Мэтч — чат сразу.",
            },
            {
              n: "03",
              title: "Чат",
              text: "Текст, голос, кружки-видео, фото, файлы, реакции, печатает/онлайн, всё в реальном времени.",
            },
          ].map((step) => (
            <div
              key={step.n}
              className="glass relative overflow-hidden p-6 sm:p-7"
            >
              <div className="display text-5xl font-semibold tracking-tight text-ember-400/80 sm:text-6xl">
                {step.n}
              </div>
              <div className="mt-4 display text-xl font-semibold tracking-tight sm:text-2xl">
                {step.title}
              </div>
              <p className="mt-3 text-sm text-ink-100/70 sm:text-[15px]">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-3xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="glass relative overflow-hidden p-7 sm:p-10">
          <h3 className="display text-2xl font-semibold tracking-tight sm:text-3xl">
            Серьёзно — это безопасно?
          </h3>
          <p className="mt-3 text-ink-100/75">
            Всё хранится у нас, никаких сторонних сервисов.
            Жалобы рассматривает школьная админ-команда. Жалоба → ребан в одно действие.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-ink-100/70">
            <li className="flex gap-2.5"><Dot /> 14+, без скринов и пересылок</li>
            <li className="flex gap-2.5"><Dot /> Только школа №57 — email-домен / приглашение</li>
            <li className="flex gap-2.5"><Dot /> Голос и видео доступны только мэтчам</li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-white/[0.04] px-5 py-8 text-center text-xs text-ink-200/50 sm:px-8">
        MATCH 57 · standalone web app · est. 1957
      </footer>
    </main>
  );
}

function Dot() {
  return (
    <span className="mt-2 h-1 w-1 flex-none rounded-full bg-ember-400" />
  );
}

/**
 * Lightweight phone-frame mockup. Pure CSS, no images, no 3D, no
 * framer-motion — paints once and stays static. Looks Apple-/Linear-
 * ish without burning a single frame after first paint.
 */
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xs md:max-w-none">
      <div className="absolute -inset-10 -z-10 rounded-full bg-ember-500/20 blur-3xl" />
      <div className="relative mx-auto aspect-[9/19] w-[260px] rounded-[2.5rem] border border-white/15 bg-ink-950/60 p-2 shadow-card backdrop-blur-xl sm:w-[280px]">
        <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-gradient-to-b from-ink-900 to-ink-950">
          {/* Notch */}
          <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />

          {/* Header */}
          <div className="absolute inset-x-0 top-9 flex items-center gap-2 px-4">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-ember-400 to-rose-500" />
            <div>
              <div className="text-[11px] font-medium leading-tight">Аня</div>
              <div className="text-[9px] text-ember-300/80">онлайн</div>
            </div>
          </div>

          {/* Bubbles */}
          <div className="absolute inset-x-3 top-20 flex flex-col gap-1.5">
            <Bubble side="left" delay="0s">привет 👋</Bubble>
            <Bubble side="left" delay="0.1s">тебя на физру сегодня?</Bubble>
            <Bubble side="right" delay="0.2s">я в столовой 🍕</Bubble>
            <Bubble side="left" delay="0.3s">бегу 💨</Bubble>
            <div className="self-end">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px]">
                ❤️ 1
              </span>
            </div>
          </div>

          {/* Composer */}
          <div className="absolute inset-x-3 bottom-3 flex h-9 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 backdrop-blur">
            <div className="flex-1 text-[10px] text-ink-200/40">Сообщение…</div>
            <div className="h-6 w-6 rounded-full bg-ember-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  children,
  side,
  delay,
}: {
  children: React.ReactNode;
  side: "left" | "right";
  delay: string;
}) {
  return (
    <div
      style={{ animationDelay: delay }}
      className={`max-w-[80%] animate-fade-up rounded-2xl px-2.5 py-1 text-[10px] ${
        side === "right"
          ? "self-end bg-ember-500/85 text-ink-950"
          : "self-start bg-white/10"
      }`}
    >
      {children}
    </div>
  );
}

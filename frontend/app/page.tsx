"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/components/providers/AuthProvider";

const STATS = [
  { kicker: "школа", value: "№57", title: "Калининград" },
  { kicker: "возраст", value: "14+", title: "только свои" },
  { kicker: "формат", value: "веб", title: "без установки приложения" },
];

const STEPS = [
  {
    n: "01",
    title: "Регистрация",
    text: "Логин, пароль, возраст, кого ищешь, до 3 фото или видео. Минимум полей — максимум знакомств.",
  },
  {
    n: "02",
    title: "Свайпай",
    text: "Свайп влево/вправо или клавиатура. Лайк → уведомление другому. Мэтч → чат сразу.",
  },
  {
    n: "03",
    title: "Общайся",
    text: "Встроенный мессенджер: текст, голос, видео-кружки, фото, реакции, печатает / онлайн / прочитано.",
  },
];

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

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.2]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-ember-gradient"
      />

      <header className="sticky top-0 z-40 mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <div className="display text-2xl">
          MATCH<span className="text-ember-400"> 57</span>
        </div>
        <nav className="flex items-center gap-2">
          {me ? (
            <Link href="/swipe" className="btn-primary">
              Открыть приложение
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Войти
              </Link>
              <Link href={`/register${refQs}`} className="btn-primary">
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </header>

      <section
        ref={heroRef}
        className="relative mx-auto flex min-h-[88dvh] max-w-6xl flex-col items-center justify-center px-5 pb-20 pt-10 sm:px-8"
      >
        <motion.div
          style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}
          className="relative z-10 mx-auto max-w-3xl text-center"
        >
          <span className="pill mb-6 mx-auto">
            знакомства школы №57 · Калининград
          </span>
          <h1 className="display text-balance text-5xl leading-[0.95] sm:text-7xl md:text-[7.5rem]">
            Найди <em className="not-italic text-ember-400">своих</em>
            <br />в 57-й.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-100/80 sm:text-xl">
            Только ученики и выпускники 57-й. Анкета, свайпы, мэтчи и встроенный
            мессенджер — на одном сайте, без сторонних мессенджеров и без
            установки приложения.
          </p>

          <div id="login" className="mt-10 flex flex-col items-center gap-3">
            {me ? (
              <Link href="/swipe" className="btn-primary text-base">
                Свайпать →
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Link
                  href={`/register${refQs}`}
                  className="btn-primary text-base"
                >
                  Создать профиль
                </Link>
                <Link href="/login" className="btn-ghost text-base">
                  Войти
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-ink-200/60"
        >
          ↓ как это устроено
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {STATS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="glass-soft flex flex-col items-start gap-1 px-6 py-7"
            >
              <span className="label">{s.kicker}</span>
              <span className="display text-5xl">{s.value}</span>
              <span className="text-ink-100/70">{s.title}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <h2 className="display mb-12 text-balance text-4xl sm:text-6xl">
          Три экрана —<br />
          <span className="text-ember-400">и ты внутри.</span>
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ delay: i * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="glass relative overflow-hidden p-7"
            >
              <div className="display text-7xl text-ember-400/80">{step.n}</div>
              <div className="mt-4 display text-2xl">{step.title}</div>
              <p className="mt-3 text-ink-100/80">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
        <Glass>
          <h3 className="display text-2xl">Это безопасно?</h3>
          <p className="mt-3 text-ink-100/80">
            Сайт сделан внутри школы и для школы. Все данные хранятся у нас,
            никаких сторонних сервисов. Жалобы рассматривает админ-команда,
            бан — в одно действие.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-ink-100/70">
            <li>· 14+, только ученики и выпускники 57-й</li>
            <li>· Фото, голос и видео видны только мэтчам</li>
            <li>· Никаких скриншотов и пересылок «дальше»</li>
          </ul>
        </Glass>
      </section>

      <footer className="border-t border-white/5 px-5 py-10 text-center text-xs text-ink-200/60 sm:px-8">
        MATCH 57 · школа №57 · Калининград
      </footer>
    </main>
  );
}

function Glass({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass relative overflow-hidden p-7 sm:p-10">{children}</div>
  );
}

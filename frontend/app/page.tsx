"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { TelegramLogin } from "@/components/TelegramLogin";
import { useAuth } from "@/components/providers/AuthProvider";

const STATS = [
  { kicker: "из", value: "1957", title: "школа №57" },
  { kicker: "формат", value: "🃏", title: "swipe-знакомства" },
  { kicker: "от", value: "14+", title: "только свои" },
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
  const refId = ref ? Number(ref) || null : null;

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.2]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      {/* Aurora background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-ember-gradient"
      />

      {/* Top bar */}
      <header className="sticky top-0 z-40 mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <div className="display text-2xl">
          MATCH<span className="text-ember-400"> 57</span>
        </div>
        <nav className="flex items-center gap-2">
          {me?.registered ? (
            <Link href="/swipe" className="btn-primary">
              Открыть приложение
            </Link>
          ) : me ? (
            <Link href="/register" className="btn-primary">
              Заполнить анкету
            </Link>
          ) : (
            <a
              href="#login"
              className="btn-ghost"
            >
              Войти
            </a>
          )}
        </nav>
      </header>

      {/* HERO */}
      <section
        ref={heroRef}
        className="relative mx-auto flex min-h-[88dvh] max-w-6xl flex-col items-center justify-center px-5 pb-20 pt-10 sm:px-8"
      >
        <motion.div
          style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}
          className="relative z-10 mx-auto max-w-3xl text-center"
        >
          <span className="pill mb-6 mx-auto">est. 1957 · кружки и анкеты</span>
          <h1 className="display text-balance text-5xl leading-[0.95] sm:text-7xl md:text-[7.5rem]">
            Найди <em className="not-italic text-ember-400">своих</em>
            <br />
            в 57-й.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-100/80 sm:text-xl">
            Все, кого ты раньше встречал у вахты или в столовой —
            теперь в одном свайп-стеке. Тот же бот, та же база, новый дом.
          </p>

          <div id="login" className="mt-10 flex flex-col items-center gap-3">
            {me ? (
              <Link
                href={me.registered ? "/swipe" : "/register"}
                className="btn-primary text-base"
              >
                {me.registered ? "Свайпать →" : "Заполнить анкету →"}
              </Link>
            ) : (
              <>
                <TelegramLogin referrerId={refId} />
                <p className="max-w-xs text-xs text-ink-200/60">
                  Авторизация через Telegram — без паролей и регистраций.
                  Используется тот же аккаунт, что и в боте.
                </p>
              </>
            )}
          </div>
        </motion.div>

        {/* Floating cards */}
        <FloatingCards />

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-ink-200/60"
        >
          ↓ как это устроено
        </motion.div>
      </section>

      {/* Stats strip */}
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

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <h2 className="display mb-12 text-balance text-4xl sm:text-6xl">
          Три экрана —<br />
          <span className="text-ember-400">и ты внутри.</span>
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Войди через Telegram",
              text: "Один тап — и ты тот же user_id, что в боте. Все твои лайки, мэтчи и сообщения уже здесь.",
            },
            {
              n: "02",
              title: "Заполни анкету",
              text: "Возраст, кого ищешь, до 3 фото или видео, описание. То же что в боте — ровно те же поля.",
            },
            {
              n: "03",
              title: "Свайпай",
              text: "Жест влево/вправо или клавиатура. Лайк → уведомление в Telegram. Мэтч → контакт сразу в чат.",
            },
          ].map((step, i) => (
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

      {/* Disclaimer */}
      <section className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
        <Glass>
          <h3 className="display text-2xl">Серьёзно — это безопасно?</h3>
          <p className="mt-3 text-ink-100/80">
            Авторизация через Telegram. Никаких паролей, никаких email. Бот
            продолжает работать — все данные общие. Жалобы и баны проходят
            через ту же админ-команду, что и в Telegram.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-ink-100/70">
            <li>· 14+, без скринов и пересылок</li>
            <li>· Только своя школа</li>
            <li>· Жалоба → ребан в обоих интерфейсах одновременно</li>
          </ul>
        </Glass>
      </section>

      <footer className="border-t border-white/5 px-5 py-10 text-center text-xs text-ink-200/60 sm:px-8">
        MATCH 57 · поддержка{" "}
        <a
          className="underline hover:text-ember-300"
          href="https://t.me/sneakerdash_manager"
        >
          @sneakerdash_manager
        </a>
      </footer>
    </main>
  );
}

function Glass({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass relative overflow-hidden p-7 sm:p-10">{children}</div>
  );
}

function FloatingCards() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 hidden md:block"
    >
      {[
        { rot: -8, x: -260, y: 40, label: "Аня, 16" },
        { rot: 6, x: 240, y: 80, label: "Денис, 17" },
        { rot: -3, x: -140, y: 240, label: "Лиза, 15" },
        { rot: 9, x: 180, y: 280, label: "Тимур, 17" },
      ].map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 60, rotate: 0 }}
          animate={{ opacity: 0.85, y: c.y, rotate: c.rot }}
          transition={{
            delay: 0.4 + i * 0.1,
            duration: 1.4,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{
            position: "absolute",
            left: "50%",
            top: "20%",
            transform: `translateX(${c.x}px) rotate(${c.rot}deg)`,
          }}
        >
          <div className="glass aspect-[3/4] w-44 p-3">
            <div className="h-full w-full rounded-2xl bg-gradient-to-br from-ember-500/40 via-rose-500/30 to-ink-900/60" />
            <div className="mt-2 flex items-baseline justify-between text-xs">
              <span className="display text-base">{c.label}</span>
              <span className="text-ink-100/60">57</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

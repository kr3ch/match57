"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "@/components/Toaster";

export default function SettingsPage() {
  const { me, refresh, logout } = useAuth();
  const router = useRouter();
  const { data: ref, mutate: mutateRef } = useSWR("me/referral", () =>
    api.referral(),
  );

  return (
    <main className="flex flex-col gap-5">
      <h1 className="display text-4xl">настройки</h1>

      <section className="glass p-5">
        <h2 className="display text-2xl">пригласи друзей</h2>
        <p className="mt-1 text-sm text-ink-100/80">
          {ref?.bonuses ?? "Загружаем…"}
        </p>

        {ref ? (
          <div className="mt-4 space-y-2">
            <LinkBox
              label="ссылка на сайт"
              link={ref.web_link}
            />
            {ref.telegram_link ? (
              <LinkBox
                label="ссылка на бота"
                link={ref.telegram_link}
              />
            ) : null}
          </div>
        ) : null}

        <p className="mt-3 text-xs text-ink-200/60">
          Приглашённых: {ref?.count ?? 0}
        </p>
      </section>

      <section className="glass p-5">
        <h2 className="display text-2xl">видимость</h2>
        <p className="mt-1 text-sm text-ink-100/80">
          {me?.hidden
            ? "Сейчас твою анкету не видно. Можно вернуть."
            : "Можно временно спрятать анкету. Все данные останутся, никто не увидит, пока не вернёшь."}
        </p>
        <button
          type="button"
          className="btn-ghost mt-4"
          onClick={async () => {
            try {
              if (me?.hidden) await api.unhide();
              else await api.hide();
              await refresh();
              toast({
                title: me?.hidden ? "Снова видно" : "Анкета спрятана",
              });
            } catch (e) {
              toast({
                title: "Ошибка",
                body: (e as Error).message,
                tone: "error",
              });
            }
          }}
        >
          {me?.hidden ? "Показать снова" : "Скрыть анкету"}
        </button>
      </section>

      <section className="glass p-5">
        <h2 className="display text-2xl">помощь</h2>
        <p className="mt-1 text-sm text-ink-100/80">
          Если что-то сломалось или хочешь рассказать про баг — пиши{" "}
          <a
            href="https://t.me/sneakerdash_manager"
            className="text-ember-300 underline"
            target="_blank"
            rel="noreferrer"
          >
            @sneakerdash_manager
          </a>
          .
        </p>
      </section>

      <button
        type="button"
        className="btn-ghost text-rose-200"
        onClick={async () => {
          await logout();
          router.replace("/");
        }}
      >
        выйти
      </button>
    </main>
  );
}

function LinkBox({ label, link }: { label: string; link: string }) {
  return (
    <div className="glass-soft flex items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="label">{label}</div>
        <div className="truncate text-sm text-ink-100">{link}</div>
      </div>
      <button
        type="button"
        className="btn-ghost px-3 py-2 text-xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            toast({ title: "Скопировано" });
          } catch {
            toast({ title: "Не удалось скопировать", tone: "error" });
          }
        }}
      >
        копировать
      </button>
    </div>
  );
}

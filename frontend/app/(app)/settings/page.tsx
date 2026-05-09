"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";

import { APIError, api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";

export default function SettingsPage() {
  const { me, refresh, logout } = useAuth();
  const router = useRouter();
  const { push, permitted, requestPermission } = useNotifications();
  const { data: ref } = useSWR("me/referral", () => api.referrals());

  return (
    <main className="flex flex-col gap-5">
      <h1 className="display text-4xl">настройки</h1>

      <section className="glass p-5">
        <h2 className="display text-2xl">уведомления</h2>
        <p className="mt-1 text-sm text-ink-100/80">
          Включи системные уведомления — будем пинговать про мэтчи и сообщения.
          Внутри сайта тосты и звуки работают без разрешений.
        </p>
        <button
          type="button"
          className="btn-ghost mt-4"
          onClick={() => void requestPermission()}
        >
          {permitted ? "Уведомления включены" : "Разрешить уведомления"}
        </button>
      </section>

      <section className="glass p-5">
        <h2 className="display text-2xl">пригласи друзей</h2>
        <p className="mt-1 text-sm text-ink-100/80">
          Поделись ссылкой — пусть твои тоже найдут своих.
        </p>
        {ref ? (
          <div className="mt-4 space-y-2">
            <LinkBox label="реферальная ссылка" link={ref.ref_link} />
            <p className="text-xs text-ink-200/60">
              Приглашённых: {ref.count}
            </p>
          </div>
        ) : null}
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
              await api.updateProfile({ hidden: !me?.hidden });
              await refresh();
              push({
                title: me?.hidden ? "Снова видно" : "Анкета спрятана",
              });
            } catch (e) {
              if (e instanceof APIError) push({ title: "Ошибка", body: e.detail });
            }
          }}
        >
          {me?.hidden ? "Показать снова" : "Скрыть анкету"}
        </button>
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
  const { push } = useNotifications();
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
            push({ title: "Скопировано" });
          } catch {
            push({ title: "Не удалось скопировать" });
          }
        }}
      >
        копировать
      </button>
    </div>
  );
}

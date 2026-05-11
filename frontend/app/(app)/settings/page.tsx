"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";

import { APIError, api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";

export default function SettingsPage() {
  const { me, refresh, logout } = useAuth();
  const router = useRouter();
  const {
    push,
    permitted,
    requestPermission,
    enabled,
    setEnabled,
    soundEnabled,
    setSoundEnabled,
  } = useNotifications();
  const { data: ref } = useSWR("me/referral", () => api.referrals());

  return (
    <main className="flex flex-col gap-5">
      <h1 className="display text-4xl">настройки</h1>

      <section className="glass p-5">
        <h2 className="display text-2xl">уведомления</h2>
        <p className="mt-1 text-sm text-ink-100/80">
          Мэтчи, лайки и новые сообщения. Тосты и звук работают внутри
          сайта; системные — даже когда вкладка свёрнута, если разрешишь
          ниже.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <ToggleRow
            label="внутри сайта"
            hint="всплывающие тосты в углу"
            checked={enabled}
            onChange={setEnabled}
          />
          <ToggleRow
            label="звук"
            hint="короткий бип при новом уведомлении"
            checked={soundEnabled}
            onChange={setSoundEnabled}
            disabled={!enabled}
          />
        </div>

        <button
          type="button"
          className="btn-ghost mt-4"
          onClick={() => void requestPermission()}
          disabled={permitted}
        >
          {permitted ? "Системные уведомления включены" : "Разрешить системные уведомления"}
        </button>
        {permitted ? (
          <p className="mt-2 text-xs text-ink-200/60">
            Чтобы отключить системные — сделай это в настройках браузера для
            этого сайта.
          </p>
        ) : null}
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

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`glass-soft flex cursor-pointer items-center justify-between gap-3 px-4 py-3 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint ? (
          <span className="block text-xs text-ink-200/60">{hint}</span>
        ) : null}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition ${
          checked ? "bg-ember-500/70" : "bg-white/15"
        }`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={`block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
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

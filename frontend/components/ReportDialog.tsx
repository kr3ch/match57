"use client";

import { Modal } from "./Modal";
import { REPORT_REASONS } from "@/lib/types";
import { APIError, api } from "@/lib/api";
import { useNotifications } from "./providers/NotificationProvider";

export function ReportDialog({
  open,
  onClose,
  targetUserId,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  targetUserId: number | null;
  onSent?: () => void;
}) {
  const { push } = useNotifications();
  return (
    <Modal open={open} onClose={onClose} title="Пожаловаться">
      <p className="mb-4 text-sm text-ink-100/80">
        Жалоба отправляется админам школьной команды.
      </p>
      <div className="flex flex-col gap-2">
        {REPORT_REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            onClick={async () => {
              if (!targetUserId) return;
              try {
                await api.report(targetUserId, reason);
                push({ title: "Жалоба отправлена", body: "Спасибо!" });
                onSent?.();
                onClose();
              } catch (e) {
                if (e instanceof APIError) {
                  push({ title: "Ошибка", body: e.detail });
                }
              }
            }}
            className="btn-ghost justify-start"
          >
            {reason}
          </button>
        ))}
      </div>
    </Modal>
  );
}

"use client";

import { Modal } from "./Modal";
import { REPORT_REASONS } from "@/lib/types";
import { api } from "@/lib/api";
import { toast } from "./Toaster";

export function ReportDialog({
  open,
  onClose,
  targetUserId,
}: {
  open: boolean;
  onClose: () => void;
  targetUserId: number | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Пожаловаться">
      <p className="mb-4 text-sm text-ink-100/80">
        Жалоба отправляется админам. Они увидят её в админ-панели — и в
        Telegram-уведомлении.
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
                toast({ title: "Жалоба отправлена", body: "Спасибо!" });
                onClose();
              } catch (e) {
                toast({
                  title: "Ошибка",
                  body: (e as Error).message,
                  tone: "error",
                });
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

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";

type Toast = {
  id: number;
  title: string;
  body?: string;
  tone?: "default" | "match" | "error";
};

type ToastState = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  remove: (id: number) => void;
};

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, t.tone === "match" ? 6000 : 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(input: Omit<Toast, "id">) {
  useToasts.getState().push(input);
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const remove = useToasts((s) => s.remove);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={`pointer-events-auto glass max-w-md px-4 py-3 ${
              t.tone === "match"
                ? "border-rose-300/30 bg-rose-500/10"
                : t.tone === "error"
                  ? "border-rose-300/30 bg-rose-700/10"
                  : ""
            }`}
            onClick={() => remove(t.id)}
          >
            <div className="display text-lg leading-tight">{t.title}</div>
            {t.body ? (
              <div className="mt-0.5 text-sm text-ink-100/85">{t.body}</div>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

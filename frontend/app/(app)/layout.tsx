"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { me, loading } = useAuth();

  if (loading || !me) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="display animate-pulse text-2xl text-ink-200/60">
          подбираем твоих…
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-32 pt-4 sm:px-6 sm:pt-8">
      {children}
      <BottomNav />
    </div>
  );
}

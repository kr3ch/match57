"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace("/");
    else if (!me.registered) router.replace("/register");
  }, [me, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="display animate-pulse text-2xl text-ink-200/60">
          подбираем твоих…
        </div>
      </main>
    );
  }
  if (!me || !me.registered) {
    return null;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-32 pt-4 sm:px-6 sm:pt-8">
      {children}
      <BottomNav />
    </div>
  );
}

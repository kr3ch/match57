"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/AuthProvider";
import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { me, loading } = useAuth();
  const pathname = usePathname() || "";
  const router = useRouter();

  // Require email verification before accessing the app.
  useEffect(() => {
    if (loading || !me) return;
    if (me.email_verified === false) {
      router.replace("/verify-email");
    }
  }, [loading, me, router]);

  // Require at least one photo before accessing the app.
  const onEditPage = pathname.startsWith("/profile/edit");
  useEffect(() => {
    if (loading || !me) return;
    if (me.email_verified === false) return;
    if (me.photos.length === 0 && !onEditPage) {
      router.replace("/profile/edit?welcome=1");
    }
  }, [loading, me, onEditPage, router]);

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

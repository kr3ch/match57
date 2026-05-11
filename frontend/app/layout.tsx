import type { Metadata, Viewport } from "next";
import { display } from "./fonts";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "MATCH 57 — знакомства школы №57",
  description:
    "Найди своих в 57-й школе. Анкеты, лайки, мэтчи — теперь и на сайте.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050402",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ru"
      className={`${display.variable} dark`}
      suppressHydrationWarning
    >
      <body>
        <AuthProvider>
          <RealtimeProvider>
            <NotificationProvider>
              {children}
              <Toaster />
            </NotificationProvider>
          </RealtimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

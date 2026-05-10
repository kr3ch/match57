import type { Metadata, Viewport } from "next";
import { body, display } from "./fonts";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

// next.config.js sets basePath via STATIC_EXPORT. The metadata API does NOT
// prefix basePath onto absolute paths, so we do it ourselves.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "MATCH 57 — знакомства школы №57",
  description:
    "Найди своих в 57-й школе. Анкеты, лайки, мэтчи — теперь и на сайте.",
  manifest: `${BASE_PATH}/manifest.json`,
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
      className={`${display.variable} ${body.variable} dark`}
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

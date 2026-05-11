/**
 * SF Pro is Apple-licensed and can't be redistributed on the web, so we
 * use Inter — the open-source family explicitly designed as a free SF
 * stand-in — and fall back to the native SF binary via -apple-system on
 * Apple devices. Result: native SF Pro on iOS/macOS, Inter everywhere
 * else, no licence violation.
 *
 * One family, varied weights — the Apple/Linear/Arc aesthetic.
 */
import { Inter, Inter_Tight } from "next/font/google";

export const display = Inter_Tight({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const body = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

/**
 * Cross-platform Apple-style typography.
 *
 * Display + body share the same neutral sans face. On Apple devices the
 * browser hands us native SF Pro via the `-apple-system` keyword (see
 * `--font-display` / `--font-body` in globals.css). On Windows/Android/
 * Linux we fall back to self-hosted SF Pro Display (woff2 under
 * `/public/fonts`) and, finally, to Inter — an open-source SF look-alike
 * that has full Cyrillic coverage. Inter is loaded here via `next/font`
 * so it's preloaded + self-hosted without any extra CSS plumbing.
 */
import { Inter } from "next/font/google";

export const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

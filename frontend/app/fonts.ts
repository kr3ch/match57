/**
 * Distinctive font choices (per the frontend-design SKILL we deliberately
 * avoid generic Inter/Roboto/Arial). Editorial serif display + clean sans
 * body produces an upscale Tinder-meets-magazine vibe.
 */
import { Cormorant_Garamond, Manrope } from "next/font/google";

export const display = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const body = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

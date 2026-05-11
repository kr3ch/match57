/**
 * Editorial serif for display headings; the body face is SF Pro Display,
 * self-hosted from /public/fonts (see @font-face rules in globals.css).
 */
import { Cormorant_Garamond } from "next/font/google";

export const display = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

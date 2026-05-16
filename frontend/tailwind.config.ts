import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Display + body share the same Apple-style sans stack; the
        // actual order (SF Pro → self-hosted SF → Inter → system) lives
        // on the CSS variables in globals.css so we don't duplicate it.
        display: ["var(--font-display)", "-apple-system", "BlinkMacSystemFont", "ui-sans-serif", "system-ui"],
        body: ["var(--font-body)", "-apple-system", "BlinkMacSystemFont", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace"],
      },
      colors: {
        ink: {
          50: "#f7f5f2",
          100: "#ece7df",
          200: "#d4ccbe",
          300: "#a99c87",
          400: "#766955",
          500: "#4a4133",
          600: "#322b21",
          700: "#1f1a13",
          800: "#13100a",
          900: "#0a0805",
          950: "#050402",
        },
        ember: {
          50: "#fff1eb",
          100: "#ffd9c8",
          200: "#ffb89a",
          300: "#ff9468",
          400: "#ff6f3c",
          500: "#ee4f1a",
          600: "#c43c11",
          700: "#982e0e",
          800: "#6a210a",
          900: "#3f1305",
        },
        rose: {
          50: "#fff3f6",
          100: "#ffd9e1",
          200: "#ffb1c0",
          300: "#ff7a92",
          400: "#ff4f70",
          500: "#e02458",
          600: "#b51845",
          700: "#891134",
          800: "#5e0c24",
        },
        gold: {
          50: "#fbf6e7",
          100: "#f3e6b1",
          200: "#e9d27a",
          300: "#d8b649",
          400: "#b89225",
          500: "#8c6e1a",
        },
      },
      backgroundImage: {
        "noise":
          "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        "ember-gradient":
          "radial-gradient(120% 80% at 20% 0%, rgba(255,111,60,0.35), transparent 60%), radial-gradient(120% 80% at 100% 100%, rgba(224,36,88,0.30), transparent 55%)",
      },
      boxShadow: {
        glass:
          "0 1px 0 0 rgba(255,255,255,0.08) inset, 0 8px 24px -12px rgba(0,0,0,0.5)",
        card: "0 30px 60px -20px rgba(0,0,0,0.55), 0 12px 24px -12px rgba(0,0,0,0.4)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

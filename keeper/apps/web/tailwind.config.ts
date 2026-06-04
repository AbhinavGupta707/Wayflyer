import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Keeper palette — deep ink canvas, mint "rescued" accent, amber for approval.
        ink: {
          900: "#0a0e14",
          800: "#0f1622",
          700: "#16202e",
          600: "#1e2b3d",
          500: "#2a3b52",
        },
        mint: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "tick-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "tick-pop": "tick-pop 0.45s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;

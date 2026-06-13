import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["DM Mono", "Fira Code", "monospace"],
        serif: ["Literata", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: "#0f0f0d",
        "canvas-2": "#161613",
        "canvas-3": "#1e1e1a",
        "canvas-4": "#252520",
        ink: "#f0ede6",
        "ink-dim": "#a09d96",
        "ink-muted": "#5c5a55",
        "ink-faint": "#2a2925",
        amber: "#d4a832",
        "amber-dim": "#8a6c1e",
        "amber-glow": "#f0c84a",
        sage: "#5c8c6e",
        "sage-dim": "#3a5c48",
        "sage-glow": "#7ab894",
        rule: "#2a2925",
        "rule-bright": "#3d3c35",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out forwards",
        "slide-down": "slideDown 0.25s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", maxHeight: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", maxHeight: "2000px", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080a0f",
        panel: "#10141d",
        line: "#252b36",
        cyan: "#48cae4",
        mint: "#7ee787",
        amber: "#f2cc60"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;

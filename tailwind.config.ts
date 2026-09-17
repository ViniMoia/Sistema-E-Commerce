import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        brand: {
          navy: "#010E31",
          slate: "#0F172A",
          blue: "#0030E0",
          yellow: "#F0B40E",
          gold: "#F0B40E",
          muted: "#8992A3",
        },
        catalog: {
          bg: "#000000",
          card: "#0F172A",
          gold: "#B8A06A",
          text: "#F5F5F5",
          muted: "#94A3B8",
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        shimmer: {
          from: { transform: "translateX(-100%) skewX(-15deg)" },
          to: { transform: "translateX(200%) skewX(-15deg)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

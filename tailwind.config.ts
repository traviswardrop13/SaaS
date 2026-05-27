import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        sky: {
          400: "#38bdf8",
          500: "#0ea5e9",
        },
        grass: {
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
      },
      fontFamily: {
        display: ['"Baloo 2"', "system-ui", "sans-serif"],
        body: ["Nunito", "system-ui", "sans-serif"],
      },
      boxShadow: {
        chunky: "0 6px 0 0 rgba(0,0,0,0.15)",
        "chunky-sm": "0 3px 0 0 rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm, reverent palette
        parchment: "#faf6ef",
        ink: "#2b2723",
        sky: {
          50: "#eef4fb",
          100: "#d9e6f6",
          500: "#3b6ea5",
          600: "#2f5a89",
          700: "#264a71",
        },
        gold: {
          400: "#e0b24a",
          500: "#c99a34",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;

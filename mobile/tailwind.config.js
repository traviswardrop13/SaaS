/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
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
        sky: { 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7" },
        grass: { 400: "#4ade80", 500: "#22c55e", 600: "#16a34a" },
      },
    },
  },
  plugins: [],
};

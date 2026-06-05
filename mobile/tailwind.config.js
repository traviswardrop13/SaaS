/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Sona brand (the lion's mane) — warm orange.
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        // Duolingo-style semantic palette. Each action color has a darker
        // `edge` used for the chunky 3D button bottom.
        feather: {
          light: "#89e219",
          DEFAULT: "#58cc02", // primary / correct / "go"
          edge: "#58a700",
          50: "#f0fde4",
          100: "#dcfcc4",
        },
        macaw: {
          DEFAULT: "#1cb0f6", // secondary
          edge: "#1899d6",
          50: "#e8f7ff",
          100: "#cdeeff",
        },
        cardinal: {
          DEFAULT: "#ff4b4b", // wrong / retry
          edge: "#e63232",
          50: "#fff0f0",
        },
        bee: {
          DEFAULT: "#ffc800", // stars / streak / XP
          edge: "#e0a800",
        },
        // Neutrals (Duolingo "eel/wolf/hare/swan/polar").
        ink: "#3c3c3c",
        wolf: "#777777",
        hare: "#afafaf",
        swan: "#e5e5e5",
        polar: "#f7f7f7",
        // Back-compat aliases used across existing screens.
        sky: { 400: "#38bdf8", 500: "#1cb0f6", 600: "#1899d6" },
        grass: { 400: "#89e219", 500: "#58cc02", 600: "#58a700" },
      },
      borderRadius: {
        "4xl": "28px",
      },
    },
  },
  plugins: [],
};

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#FAF8F4",
        parchment: "#F1EDE4",
        ink: "#1A1815",
        ash: "#8A857C",
        gold: "#C9A96E",
        deep: "#262320",
        line: "#E5E0D5",
      },
      fontFamily: {
        display: ["var(--font-playfair)", "serif"],
        sans: ["var(--font-montserrat)", "sans-serif"],
      },
      borderRadius: { card: "14px" },
    },
  },
  plugins: [],
};
export default config;

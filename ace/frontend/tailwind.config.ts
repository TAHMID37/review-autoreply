import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // iBusinessFormula brand
        brand: {
          navy: "#1C2A4A", // primary dark - sidebar, headings, avatars
          navyDark: "#141F38", // deeper step for gradients/hover
          pink: "#DD1157", // magenta accent - primary actions, highlights
          pinkDark: "#C10E4B", // hover step for magenta
        },
        ink: "#1C2A4A",
        muted: "#5B6473",
        line: "#E4E7EC",
        surface: "#F6F7F9",
      },
      fontFamily: {
        sans: ["var(--font-raleway)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;

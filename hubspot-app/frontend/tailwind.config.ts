import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ReviewTune brand
        brand: {
          navy: "#125383", // primary - sidebar, headings, avatars
          navyDark: "#0D3F66", // deeper step for gradients/hover
          pink: "#D1035A", // magenta accent - primary actions, highlights
          pinkDark: "#A80249", // hover step for magenta
        },
        ink: "#125383",
        muted: "#4A5A6A", // brand slate
        line: "#E4E7EC",
        surface: "#EEF2F6", // brand mist
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

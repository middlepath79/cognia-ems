import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101828",
        muted: "#667085",
        brand: "#3559E0",
        "brand-soft": "#EEF2FF",
        canvas: "#F5F7FB"
      },
      boxShadow: {
        soft: "0 12px 35px rgba(16, 24, 40, 0.06)"
      }
    },
  },
  plugins: [],
};

export default config;

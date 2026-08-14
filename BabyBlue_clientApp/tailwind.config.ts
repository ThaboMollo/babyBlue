import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // BabyBlue primary palette
        primary: {
          DEFAULT: "#0B5AA8",
          dark: "#083E78",
        },
        accent: {
          DEFAULT: "#20C997",
          dark: "#0FAE7B",
        },
        // Semantic
        warning: "#F59E0B",
        error: "#EF4444",
        // Neutrals
        background: "#F7FAFC",
        surface: "#FFFFFF",
        border: "#E2E8F0",
        "text-primary": "#0F172A",
        "text-secondary": "#475569",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        input: "12px",
      },
      maxWidth: {
        mobile: "560px",
      },
      minHeight: {
        tap: "44px",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;

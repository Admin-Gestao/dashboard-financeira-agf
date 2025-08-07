import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#F2935C",
          foreground: "#010326",
        },
        secondary: {
          DEFAULT: "#BF6550",
          foreground: "#E9F2FF",
        },
        background: {
          start: "#010326",
          end: "#010440",
        },
        text: "#E9F2FF",
        destructive: {
          DEFAULT: "#ef4444", // Vermelho para despesas
          foreground: "#E9F2FF",
        },
        success: {
          DEFAULT: "#22c55e", // Verde para resultado
          foreground: "#010326",
        },
        info: {
          DEFAULT: "#3b82f6", // Azul para receita
          foreground: "#E9F2FF",
        },
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

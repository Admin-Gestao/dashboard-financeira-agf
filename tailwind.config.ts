import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#F2935C',
        secondary: '#BF6550',
        background: {
          start: '#010326',
          end: '#010440',
        },
        text: '#E9F2FF',
        card: '#1F1F3C',
        success: '#48DB8A',
        info: '#4AA8FF',
        destructive: '#E74C3C',
        warning: '#F2C14E',
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

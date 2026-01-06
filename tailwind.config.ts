import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef3e2',
          100: '#fde4b8',
          200: '#fbcb7e',
          300: '#f9a842',
          400: '#f78b1c',
          500: '#f77f0c',
          600: '#e86a07',
          700: '#c0500a',
          800: '#994010',
          900: '#7a3610',
        },
      },
    },
  },
  plugins: [],
};
export default config;




import type { Config } from "tailwindcss";

const withAlpha = (variable: string) =>
  `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: withAlpha("--background"),
        foreground: withAlpha("--foreground"),
        card: {
          DEFAULT: withAlpha("--card"),
          foreground: withAlpha("--card-foreground"),
        },
        popover: {
          DEFAULT: withAlpha("--popover"),
          foreground: withAlpha("--popover-foreground"),
        },
        primary: {
          DEFAULT: withAlpha("--primary"),
          foreground: withAlpha("--primary-foreground"),
          active: withAlpha("--primary-active"),
        },
        secondary: {
          DEFAULT: withAlpha("--secondary"),
          foreground: withAlpha("--secondary-foreground"),
        },
        muted: {
          DEFAULT: withAlpha("--muted"),
          foreground: withAlpha("--muted-foreground"),
        },
        accent: {
          DEFAULT: withAlpha("--accent"),
          foreground: withAlpha("--accent-foreground"),
        },
        destructive: {
          DEFAULT: withAlpha("--destructive"),
          foreground: withAlpha("--destructive-foreground"),
        },
        border: withAlpha("--border"),
        input: withAlpha("--input"),
        ring: withAlpha("--ring"),
        link: withAlpha("--link"),
        brand: {
          blue: withAlpha("--brand-blue"),
          "blue-soft": withAlpha("--brand-blue-soft"),
          "blue-on-dark": withAlpha("--brand-blue-on-dark"),
          yellow: withAlpha("--brand-yellow"),
          "yellow-soft": withAlpha("--brand-yellow-soft"),
        },
        "text-secondary": withAlpha("--text-secondary"),
        success: withAlpha("--success"),
        warning: withAlpha("--warning"),
        surface: {
          soft: withAlpha("--surface-soft"),
          strong: withAlpha("--surface-strong"),
          dark: withAlpha("--surface-dark"),
          elevated: withAlpha("--surface-dark-elevated"),
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "display-xl": ["4rem", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display-lg": ["3rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-md": ["2.25rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        "display-sm": ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
      },
      borderRadius: {
        "ui-sm": "var(--radius-sm)",
        ui: "var(--radius-md)",
        "ui-lg": "var(--radius-lg)",
        "ui-xl": "var(--radius-xl)",
      },
      boxShadow: {
        soft: "0 1px 3px rgb(17 17 17 / 0.06)",
        float: "0 18px 54px rgb(17 17 17 / 0.14)",
      },
    },
  },
  plugins: [],
};
export default config;


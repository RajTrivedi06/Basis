import type { Config } from "tailwindcss";

/**
 * Tailwind config for Basis v2.
 *
 * Colors are exposed as references to CSS variables defined in globals.css
 * so both `bg-residual` and `bg-[var(--residual)]` resolve the same value.
 * The tokens themselves live in globals.css; Tailwind just names them.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SF Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // The residual. Used nowhere else.
        residual: {
          DEFAULT: "var(--residual)",
          dim: "var(--residual-dim)",
          bg: "var(--residual-bg)",
          line: "var(--residual-line)",
        },
        // Interface accent — terracotta. Never used to render the residual.
        accent: {
          DEFAULT: "var(--accent)",
          dim: "var(--accent-dim)",
          bg: "var(--accent-bg)",
          line: "var(--accent-line)",
        },
        // Factor palette — muted warm neutrals, subordinate to residual.
        factor: {
          provider: "var(--factor-provider)",
          commitment: "var(--factor-commitment)",
          region: "var(--factor-region)",
          bundle: "var(--factor-bundle)",
        },
        // Text
        ink: {
          DEFAULT: "var(--ink)",
          hi: "var(--ink-hi)",
          mid: "var(--ink-mid)",
          dim: "var(--ink-dim)",
          faint: "var(--ink-faint)",
        },
        // Surfaces
        panel: {
          DEFAULT: "var(--panel)",
          hi: "var(--panel-hi)",
          lo: "var(--panel-lo)",
        },
        line: {
          DEFAULT: "var(--line)",
          hi: "var(--line-hi)",
          lo: "var(--line-lo)",
        },
        bg: {
          DEFAULT: "var(--bg)",
          deep: "var(--bg-deep)",
        },
        // Semantic
        verdict: {
          ok: "var(--verdict-ok)",
          warn: "var(--verdict-warn)",
          bad: "var(--verdict-bad)",
        },
        unknown: "var(--unknown)",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
      },
    },
  },
  plugins: [],
};

export default config;

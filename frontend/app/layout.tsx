import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
import { AppProviders } from "@/components/providers";
import { AskWidgetRoot } from "@/components/ask/AskWidgetRoot";
import { SiteHeader } from "@/components/layout/SiteHeader";
import "./globals.css";

// Newsreader is the one serif site-wide; sans and mono are system stacks
// (see --f-sans / --f-mono in globals.css). Loaded variable so weights
// 400–600 and `font-optical-sizing: auto` both resolve from one file.
const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Basis — GPU Compute Fungibility Study",
  description:
    "A public-data study quantifying GPU compute fungibility across cloud providers, decomposing price dispersion into observable factors and residual basis risk.",
};

export const viewport: Viewport = {
  themeColor: "#FAF9F5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={serif.variable}>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--ink)] antialiased">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader />
        <AppProviders>
          <main id="main">{children}</main>
          <AskWidgetRoot />
        </AppProviders>
        <Footer />
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-baseline justify-between gap-3 px-10 py-8">
        <span className="text-[12.5px] text-[var(--ink-mid)]">
          <span className="serif mr-[10px] font-semibold text-[var(--ink)]">
            Basis
          </span>
          — research artifact · public data · 2026
        </span>
        <span className="mono text-[11px] text-[var(--ink-dim)]">
          Not a price aggregator · Not a derivatives engine
        </span>
      </div>
    </footer>
  );
}

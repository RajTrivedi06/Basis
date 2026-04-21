import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { AppProviders } from "@/components/providers";
import { Nav } from "@/components/layout/Nav";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Basis — GPU Compute Fungibility Study",
  description:
    "A public-data study quantifying GPU compute fungibility across cloud providers, decomposing price dispersion into observable factors and residual basis risk.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-screen bg-[var(--bg)] text-[var(--ink)] antialiased">
        <header
          className="sticky top-0 z-50 border-b border-[var(--line)]"
          style={{
            background: "rgba(17,24,39,0.82)",
            backdropFilter: "saturate(1.2) blur(12px)",
            WebkitBackdropFilter: "saturate(1.2) blur(12px)",
          }}
        >
          <div className="mx-auto flex max-w-[1480px] items-center gap-7 px-10">
            <Link
              href="/"
              className="flex items-baseline gap-2.5 py-4"
            >
              <span
                className="font-serif text-[19px] tracking-[-0.01em] text-[var(--ink-hi)]"
              >
                Basis
              </span>
              <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-dim)]">
                v2 · research
              </span>
            </Link>
            <Nav />
            <div className="flex-1" />
          </div>
        </header>
        <AppProviders>
          {/* Temporary container for Stage 1. When pages are ported in Stage 5+
              they wrap themselves in `.page-wide` / `.page` per the prototype,
              at which point the padding/max-width here should be removed. */}
          <main className="mx-auto max-w-[1480px] px-10 py-8">{children}</main>
        </AppProviders>
        <Footer />
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="mx-auto mt-20 max-w-[1480px] border-t border-[var(--line-lo)] px-10 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-sm text-[var(--ink)]">Basis</span>
          <span className="caption mono">
            research artifact · public data · 2026
          </span>
        </div>
        <div className="caption mono">
          Not a price aggregator · Not a derivatives engine
        </div>
      </div>
    </footer>
  );
}

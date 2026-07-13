import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers";
import { BasisLogo } from "@/components/layout/BasisLogo";
import { SiteHeader } from "@/components/layout/SiteHeader";
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

export const viewport: Viewport = {
  themeColor: "#111827",
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
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader />
        <AppProviders>
          <main id="main">{children}</main>
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
        <div className="flex flex-wrap items-center gap-4">
          <BasisLogo variant="footer" />
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

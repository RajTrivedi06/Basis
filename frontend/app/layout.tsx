import type { Metadata } from "next";
import Link from "next/link";
import { AppProviders } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basis — GPU Compute Fungibility Study",
  description:
    "A public-data study quantifying GPU compute fungibility across cloud providers, decomposing price dispersion into observable factors and residual basis risk.",
};

const navItems = [
  { href: "/", label: "Findings" },
  { href: "/dispersion", label: "Dispersion" },
  { href: "/basis", label: "Basis Decomposition" },
  { href: "/providers", label: "Providers" },
  { href: "/methodology", label: "Methodology" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <header className="border-b border-gray-800">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Basis
            </Link>
            <nav className="flex gap-6 text-sm text-gray-400">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-gray-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <AppProviders>
          <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}

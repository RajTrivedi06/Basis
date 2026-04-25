"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Findings" },
  { href: "/dispersion", label: "Dispersion" },
  { href: "/basis", label: "Basis" },
  { href: "/providers", label: "Providers" },
  { href: "/methodology", label: "Methodology" },
];

function NavLinks() {
  const pathname = usePathname();
  const params = useSearchParams();
  // Preserve ?sku= across page navigation so the selected SKU survives
  // nav clicks without each page re-deriving it from scratch.
  const sku = params.get("sku");
  const suffix = sku ? `?sku=${encodeURIComponent(sku)}` : "";

  return (
    <nav className="ml-2 flex items-center gap-6">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={`${item.href}${suffix}`}
            className={`nav-link ${active ? "active" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Nav() {
  return (
    <Suspense fallback={<nav className="ml-2 flex items-center gap-6" aria-hidden />}>
      <NavLinks />
    </Suspense>
  );
}

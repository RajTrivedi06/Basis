"use client";

import Link from "next/link";
import { BasisLogo } from "@/components/layout/BasisLogo";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Findings" },
  { href: "/dispersion", label: "Dispersion" },
  { href: "/basis", label: "Basis" },
  { href: "/providers", label: "Providers" },
  { href: "/explainability", label: "Explainability" },
  { href: "/methodology", label: "Methodology" },
];

/** Nav numbers are positional: 01–06 follow the order of NAV_ITEMS. */
function navNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function RailLink({
  item,
  num,
  active,
  href,
  onNavigate,
  variant,
}: {
  item: (typeof NAV_ITEMS)[number];
  num: string;
  active: boolean;
  href: string;
  onNavigate?: () => void;
  variant: "rail" | "stage";
}) {
  const className =
    variant === "rail"
      ? `rail-link${active ? " is-active" : ""}`
      : `stage-link${active ? " is-active" : ""}`;

  return (
    <Link
      href={href}
      className={className}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className={`${variant}-link__index`}>{num}</span>
      <span className={`${variant}-link__label`}>{item.label}</span>
      {variant === "rail" ? (
        <span className="rail-link__indicator" aria-hidden />
      ) : null}
    </Link>
  );
}

function SiteHeaderInner() {
  const pathname = usePathname();
  const params = useSearchParams();
  const stageId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navState, setNavState] = useState<"top" | "visible" | "hidden">("top");

  const sku = params.get("sku");
  const suffix = sku ? `?sku=${encodeURIComponent(sku)}` : "";

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    const threshold = 72;
    const deltaMin = 6;

    const onScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        if (menuOpen) return;

        const y = window.scrollY;
        const prev = lastScrollYRef.current;

        if (y <= threshold) {
          setNavState("top");
        } else if (y < prev - deltaMin) {
          setNavState("visible");
        } else if (y > prev + deltaMin) {
          setNavState("hidden");
        }

        lastScrollYRef.current = y;
      });
    };

    lastScrollYRef.current = window.scrollY;
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = "";
      return;
    }

    setNavState("visible");
    document.body.style.overflow = "hidden";
    const firstLink = stageRef.current?.querySelector<HTMLElement>("a.stage-link");
    firstLink?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        toggleRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  const railHidden = navState === "hidden" && !menuOpen;

  return (
    <>
      <div
        className={`site-header-rail site-header-rail--${navState}${menuOpen ? " is-pinned" : ""}`}
        aria-hidden={railHidden}
      >
        <header className="site-header-island">
          <Link href="/" className="site-header-island__brand" aria-label="Basis home">
            <BasisLogo variant="header" />
          </Link>

          <span className="site-header-island__divider" aria-hidden />

          <nav className="site-nav-rail" aria-label="Main navigation">
            <div className="site-nav-rail__track">
              {NAV_ITEMS.map((item, index) => (
                <RailLink
                  key={item.href}
                  item={item}
                  num={navNumber(index)}
                  active={isActive(pathname, item.href)}
                  href={`${item.href}${suffix}`}
                  variant="rail"
                />
              ))}
            </div>
          </nav>

          <span className="site-header-island__badge" aria-hidden>
            Public data
          </span>

          <button
            ref={toggleRef}
            type="button"
            className="site-header-island__menu"
            aria-expanded={menuOpen}
            aria-controls={stageId}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="site-header-island__menu-bars" aria-hidden>
              <span />
              <span />
            </span>
          </button>
        </header>
      </div>

      <div
        className={`site-nav-stage${menuOpen ? " is-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <div
          className={`site-nav-stage__backdrop${menuOpen ? " is-visible" : ""}`}
          aria-hidden
          onClick={closeMenu}
        />

        <div
          ref={stageRef}
          id={stageId}
          className="site-nav-stage__panel"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
        >
          <div className="site-nav-stage__head">
            <span className="site-nav-stage__eyebrow">Navigate</span>
            <button
              type="button"
              className="site-nav-stage__close"
              onClick={closeMenu}
            >
              Close
            </button>
          </div>

          <nav className="site-nav-stage__list" aria-label="Main navigation">
            {NAV_ITEMS.map((item, index) => (
              <RailLink
                key={item.href}
                item={item}
                num={navNumber(index)}
                active={isActive(pathname, item.href)}
                href={`${item.href}${suffix}`}
                onNavigate={closeMenu}
                variant="stage"
              />
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}

export function SiteHeader() {
  return (
    <Suspense
      fallback={
        <div className="site-header-rail" aria-hidden>
          <header className="site-header-island">
            <BasisLogo variant="header" />
          </header>
        </div>
      }
    >
      <SiteHeaderInner />
    </Suspense>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Delay in ms before the reveal transition starts after entering view. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  /** Threshold for intersection observer. */
  threshold?: number;
  /** rootMargin string for the observer (negative bottom triggers earlier). */
  rootMargin?: string;
}

/**
 * Lightweight scroll-reveal wrapper. Uses IntersectionObserver to add the
 * `is-in` class once the element enters the viewport, then unobserves so the
 * transition only plays once. Honors prefers-reduced-motion via the CSS.
 *
 * Always renders a div — keeps the type surface narrow and lets Next.js
 * preserve the wrapper layout across the page.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  style,
  threshold = 0.18,
  rootMargin = "0px 0px -8% 0px",
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const mergedStyle: CSSProperties = {
    ...(style ?? {}),
    ...(delay
      ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties)
      : {}),
  };

  return (
    <div
      ref={ref}
      className={`reveal ${inView ? "is-in" : ""} ${className}`.trim()}
      style={mergedStyle}
    >
      {children}
    </div>
  );
}

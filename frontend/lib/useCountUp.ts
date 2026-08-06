"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tween a number from its current displayed value up to `target` over
 * `durationMs`, using `easeOutCubic`. Returns the formatted display
 * string so callers can drop it straight into JSX.
 *
 * Behaviour:
 * - If `target` is null/undefined (loading or errored upstream query)
 *   the hook returns the sentinel "-" and does not run the animation.
 *   The sentinel is returned regardless of the supplied `format`.
 * - If `target` changes mid-flight, the tween is restarted from the
 *   currently-displayed value rather than snapping back to 0.
 * - Respects `prefers-reduced-motion: reduce`: snaps straight to the
 *   final value with no rAF loop.
 *
 * `format` is applied at render time only — it is NOT a dependency of
 * the rAF effect, so callers may inline-create a formatter without
 * restarting the animation on every render.
 *
 * No animation library is used — vanilla `requestAnimationFrame` only.
 */
export type UseCountUpOptions = {
  durationMs?: number;
  delayMs?: number;
  format?: (n: number) => string;
};

const DEFAULT_FORMAT = (n: number): string => `~${Math.round(n)}%`;

export function useCountUp(
  target: number | null | undefined,
  options: UseCountUpOptions = {}
): string {
  const durationMs = options.durationMs ?? 1100;
  const delayMs = options.delayMs ?? 0;
  const format = options.format ?? DEFAULT_FORMAT;

  const [display, setDisplay] = useState<number | null>(target ?? null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayRef = useRef<number>(target ?? 0);

  useEffect(() => {
    displayRef.current = display ?? 0;
  }, [display]);

  useEffect(() => {
    const cancel = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    if (target === null || target === undefined) {
      cancel();
      setDisplay(null);
      return cancel;
    }

    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      cancel();
      setDisplay(target);
      return cancel;
    }

    const from = displayRef.current;
    const to = target;

    if (from === to) {
      cancel();
      setDisplay(to);
      return cancel;
    }

    const start = (timestamp: number) => {
      const tick = (now: number) => {
        const t = Math.min(1, (now - timestamp) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = from + (to - from) * eased;
        setDisplay(value);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (delayMs > 0) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        start(performance.now());
      }, delayMs);
    } else {
      start(performance.now());
    }

    return cancel;
  }, [target, durationMs, delayMs]);

  if (display === null || display === undefined) return "-";
  return format(display);
}

"use client";

import { useEffect, useState } from "react";
import {
  collectNavBackdropSections,
  getHeaderProbeY,
  resolveNavBackdrop,
  type NavBackdrop,
} from "@/lib/navBackdrop";

/**
 * Tracks which story-act background sits under the sticky header and returns
 * the nav theme token that should paint the island.
 */
export function useNavBackdrop(enabled: boolean): NavBackdrop {
  const [backdrop, setBackdrop] = useState<NavBackdrop>(enabled ? "film" : "paper");

  useEffect(() => {
    if (!enabled) {
      setBackdrop("paper");
      return;
    }

    const rail = document.querySelector(".site-header-rail");
    let raf: number | null = null;

    const paint = () => {
      raf = null;
      const sections = collectNavBackdropSections();
      const next = resolveNavBackdrop(getHeaderProbeY(rail), sections);
      setBackdrop((current) => (current === next ? current : next));
    };

    const schedule = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [enabled]);

  return backdrop;
}

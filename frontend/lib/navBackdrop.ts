/** Background families behind the sticky header on the story landing page. */
export type NavBackdrop = "film" | "paper" | "paper-deep" | "paper-warm";

export interface NavBackdropSection {
  top: number;
  bottom: number;
  backdrop: NavBackdrop;
}

/**
 * Document Y of the point we treat as "under" the nav island — slightly
 * below the rail top so pinned sections still read correctly.
 */
export function getHeaderProbeY(headerRail: Element | null): number {
  if (headerRail === null) return 36;
  const rect = headerRail.getBoundingClientRect();
  return window.scrollY + rect.top + rect.height * 0.55;
}

/** Map scroll position to the landing act whose background sits under the nav. */
export function resolveNavBackdrop(
  probeY: number,
  sections: NavBackdropSection[]
): NavBackdrop {
  if (sections.length === 0) return "paper";

  for (const section of sections) {
    if (probeY >= section.top && probeY < section.bottom) {
      return section.backdrop;
    }
  }

  if (probeY < sections[0].top) return sections[0].backdrop;

  const last = sections[sections.length - 1];
  if (probeY >= last.bottom) return last.backdrop;

  return "paper";
}

export function collectNavBackdropSections(
  root: ParentNode = document
): NavBackdropSection[] {
  const nodes = root.querySelectorAll<HTMLElement>("[data-nav-backdrop]");
  return Array.from(nodes).map((el) => {
    const rect = el.getBoundingClientRect();
    const backdrop = el.dataset.navBackdrop as NavBackdrop | undefined;
    return {
      top: window.scrollY + rect.top,
      bottom: window.scrollY + rect.bottom,
      backdrop: backdrop ?? "paper",
    };
  });
}

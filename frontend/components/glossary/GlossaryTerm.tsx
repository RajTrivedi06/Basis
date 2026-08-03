"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryTermKey } from "./terms";

interface GlossaryTermProps {
  /** Which C21 entry to show. */
  term: GlossaryTermKey;
  /**
   * Inline text for the trigger. Defaults to the glossary's own term so the
   * common case reads naturally; pass children to inflect ("residuals",
   * "decomposed") without editing the definition.
   */
  children?: ReactNode;
}

/**
 * Tap-to-explain glossary term (design doc §10 C21).
 *
 * The definition is always in the server HTML and toggled by the `hidden`
 * attribute, so the copy is readable without JavaScript and search engines see
 * it. The trigger is a real button with `aria-expanded` — never hover-only —
 * so keyboard and touch users get the same affordance as a mouse.
 */
export function GlossaryTerm({ term, children }: GlossaryTermProps) {
  const entry = GLOSSARY[term];
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const node = wrapperRef.current;
      if (node && !node.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  return (
    <span className="gloss" ref={wrapperRef}>
      <button
        type="button"
        className="gloss__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        {children ?? entry.term}
      </button>
      <span className="gloss__panel" id={panelId} role="note" hidden={!open}>
        <span className="gloss__term">{entry.term}</span>
        <span className="gloss__def">{entry.definition}</span>
      </span>
    </span>
  );
}

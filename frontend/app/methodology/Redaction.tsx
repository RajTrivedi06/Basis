"use client";

import { useState } from "react";

interface RedactionProps {
  children: string;
  label?: string;
}

/** Black-bar redact that reveals on click/focus — bulletin micro-interaction. */
export function Redaction({
  children,
  label = "redacted",
}: RedactionProps) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      className="bull-redact"
      aria-label={label}
      aria-pressed={open}
      onClick={() => setOpen((v) => !v)}
    >
      {children}
    </button>
  );
}

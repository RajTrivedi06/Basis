"use client";

import { useState } from "react";

/**
 * A line released with one phrase struck out, and a bar you can lift.
 *
 * The words are always in the DOM and always in the accessibility tree — the
 * bar is a visual overlay, not a secret — so a screen reader gets the whole
 * sentence and the toggle reports its own state. On a phone the bar is a tap
 * target with real height; on a pointer device hovering it is enough.
 */
export function RedactedLine({
  before,
  redacted,
  after,
}: {
  before: string;
  /** Keep this short: it must not wrap at 390px. */
  redacted: string;
  after: string;
}) {
  const [lifted, setLifted] = useState(false);

  return (
    <p className="fc-redact" data-lifted={lifted ? "true" : undefined}>
      {before}
      <button
        type="button"
        className="fc-redact__toggle"
        aria-pressed={lifted}
        onClick={() => setLifted((v) => !v)}
      >
        <span className="fc-redact__word">{redacted}</span>
        <span className="fc-redact__bar" aria-hidden />
      </button>
      {after}
    </p>
  );
}

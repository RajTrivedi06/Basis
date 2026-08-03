import type { ReactNode } from "react";

interface TwoLayerProps {
  /** Layer one: the claim in plain English, readable on its own. */
  plain: ReactNode;
  /** Layer two: the mechanics, revealed on demand. */
  children: ReactNode;
  /** Toggle wording; the house default is "Show me how". */
  label?: string;
  className?: string;
}

/**
 * The site's two-layer narrative unit: a plain-English sentence anyone can
 * read, with the mechanics folded beneath it.
 *
 * Built on `<details>` rather than state so the second layer ships inside the
 * server HTML — the explanation is content, not an interaction, and it stays
 * readable with JavaScript off. Native disclosure semantics also give the
 * toggle its button role and expanded state for free.
 */
export function TwoLayer({
  plain,
  children,
  label = "Show me how",
  className,
}: TwoLayerProps) {
  return (
    <div className={`two-layer${className ? ` ${className}` : ""}`}>
      <p className="two-layer__plain">{plain}</p>
      <details className="two-layer__more">
        <summary className="two-layer__toggle">
          <span className="two-layer__toggle-label">{label}</span>
        </summary>
        <div className="two-layer__body">{children}</div>
      </details>
    </div>
  );
}

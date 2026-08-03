import type { ReactNode } from "react";

interface ShowMeHowProps {
  /** Layer two: the mechanics, revealed on demand. */
  children: ReactNode;
  /** Toggle wording; the house default is "Show me how". */
  label?: string;
  className?: string;
}

/**
 * Layer two on its own, for sections whose existing lede already carries the
 * plain-English claim.
 *
 * Built on `<details>` rather than state so the second layer ships inside the
 * server HTML — the explanation is content, not an interaction, and it stays
 * readable with JavaScript off. Native disclosure semantics also give the
 * toggle its button role and expanded state for free.
 */
export function ShowMeHow({
  children,
  label = "Show me how",
  className,
}: ShowMeHowProps) {
  return (
    <details className={`two-layer__more${className ? ` ${className}` : ""}`}>
      <summary className="two-layer__toggle">
        <span className="two-layer__toggle-label">{label}</span>
      </summary>
      <div className="two-layer__body">{children}</div>
    </details>
  );
}

interface TwoLayerProps extends ShowMeHowProps {
  /** Layer one: the claim in plain English, readable on its own. */
  plain: ReactNode;
}

/**
 * The site's two-layer narrative unit: a plain-English sentence anyone can
 * read, with the mechanics folded beneath it.
 */
export function TwoLayer({
  plain,
  children,
  label,
  className,
}: TwoLayerProps) {
  return (
    <div className={`two-layer${className ? ` ${className}` : ""}`}>
      <p className="two-layer__plain">{plain}</p>
      <ShowMeHow label={label}>{children}</ShowMeHow>
    </div>
  );
}

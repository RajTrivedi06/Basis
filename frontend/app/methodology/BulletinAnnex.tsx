import type { ReactNode } from "react";

interface BulletinAnnexProps {
  summary: string;
  children: ReactNode;
}

export function BulletinAnnex({ summary, children }: BulletinAnnexProps) {
  return (
    <details className="bull-annex">
      <summary>{summary}</summary>
      <div className="bull-annex__body">{children}</div>
    </details>
  );
}

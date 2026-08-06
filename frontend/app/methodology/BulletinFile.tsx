import type { ReactNode } from "react";

interface BulletinFileProps {
  id: string;
  kicker: string;
  fileNo: string;
  title: string;
  byline?: string;
  children: ReactNode;
  className?: string;
  reveal?: boolean;
}

export function BulletinFile({
  id,
  kicker,
  fileNo,
  title,
  byline,
  children,
  className = "",
  reveal = true,
}: BulletinFileProps) {
  return (
    <article
      id={id}
      className={`bull-file ${reveal ? "bull-reveal" : ""} ${className}`.trim()}
      data-reveal={reveal || undefined}
    >
      <div className="bull-file__head">
        <div className="bull-kicker">{kicker}</div>
        <div className="bull-file-no">{fileNo}</div>
      </div>
      <h2 className="bull-file__title">{title}</h2>
      {byline ? <div className="bull-byline">{byline}</div> : null}
      {children}
    </article>
  );
}

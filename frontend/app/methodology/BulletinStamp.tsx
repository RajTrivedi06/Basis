"use client";

import type { ReactNode } from "react";

interface BulletinStampProps {
  children: ReactNode;
  size?: "md" | "sm";
  className?: string;
}

export function BulletinStamp({
  children,
  size = "md",
  className = "",
}: BulletinStampProps) {
  return (
    <span
      data-stamp
      className={`bull-stamp ${size === "sm" ? "bull-stamp--sm" : ""} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      data-contrast-context="card"
      className={`rounded-[var(--radius-lg)] border border-border bg-card-surface p-6 shadow-[var(--shadow-sm)] ${className}`}
    />
  );
}

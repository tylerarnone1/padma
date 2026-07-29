import type { SelectHTMLAttributes } from "react";

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      data-contrast-context="background"
      className={`min-h-11 w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 py-2 text-sm text-foreground hover:border-muted focus:border-focus aria-invalid:border-danger ${className}`}
      {...props}
    />
  );
}

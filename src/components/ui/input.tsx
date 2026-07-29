import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      data-contrast-context="background"
      className={`min-h-11 w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/70 hover:border-muted focus:border-focus aria-invalid:border-danger ${className}`}
      {...props}
    />
  );
}

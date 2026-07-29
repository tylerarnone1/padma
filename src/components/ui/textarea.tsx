import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      data-contrast-context="background"
      className={`min-h-28 w-full resize-y rounded-[var(--radius-sm)] border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 hover:border-muted focus:border-focus aria-invalid:border-danger ${className}`}
      {...props}
    />
  );
}

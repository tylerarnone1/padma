import type { HTMLAttributes } from "react";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "neutral" | "primary" | "success" | "danger";
};

const variants = {
  neutral: "border-border bg-surface-raised text-foreground",
  primary: "border-primary/40 bg-surface-raised text-primary",
  success: "border-success/40 bg-surface-raised text-success",
  danger: "border-danger/40 bg-surface-raised text-danger",
};

export function Badge({
  className = "",
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      data-contrast-context="raised"
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

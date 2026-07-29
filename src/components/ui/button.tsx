import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-raised shadow-sm",
  ghost: "text-muted hover:bg-surface-raised hover:text-foreground",
  danger:
    "border border-danger bg-card-surface text-danger hover:bg-surface-raised shadow-sm",
};

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      data-contrast-context={
        variant === "secondary"
          ? "surface"
          : variant === "danger"
            ? "card"
            : undefined
      }
      data-contrast-hover-context={
        variant === "secondary" ||
        variant === "ghost" ||
        variant === "danger"
          ? "raised"
          : undefined
      }
      className={`inline-flex min-h-10 items-center justify-center rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

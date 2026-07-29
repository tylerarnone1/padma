import type { HTMLAttributes, ReactNode } from "react";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  variant?: "neutral" | "success" | "danger";
  children: ReactNode;
};

const indicators = {
  neutral: "bg-primary",
  success: "bg-success",
  danger: "bg-danger",
};

export function Alert({
  title,
  variant = "neutral",
  className = "",
  children,
  ...props
}: AlertProps) {
  return (
    <div
      {...props}
      data-contrast-context="card"
      className={`flex gap-3 rounded-[var(--radius-md)] border border-border bg-card-surface p-4 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2 shrink-0 rounded-full ${indicators[variant]}`}
      />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-1 text-sm leading-6 text-muted">{children}</div>
      </div>
    </div>
  );
}

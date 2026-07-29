import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonShape = "default" | "pill";

type ButtonAppearance = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  className?: string;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonAppearance;

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-raised shadow-sm",
  ghost: "text-muted hover:bg-surface-raised hover:text-foreground",
  danger:
    "border border-danger bg-card-surface text-danger hover:bg-surface-raised shadow-sm",
};

/**
 * Minimum heights, never fixed ones, so a button cannot clip wrapped content.
 *
 * No `gap` here on purpose: callers already set their own (`gap-3` in the OAuth
 * buttons), and a gap in the size would collide with theirs — see the note on
 * `buttonProps` about which of two competing utilities actually wins.
 */
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-11 px-5 py-2.5 text-sm",
};

const shapes: Record<ButtonShape, string> = {
  default: "rounded-[var(--radius-sm)]",
  pill: "rounded-full",
};

const base =
  "inline-flex items-center justify-center font-semibold disabled:cursor-not-allowed disabled:opacity-50";

function contrastContext(variant: ButtonVariant): string | undefined {
  if (variant === "secondary") {
    return "surface";
  }
  return variant === "danger" ? "card" : undefined;
}

function contrastHoverContext(variant: ButtonVariant): string | undefined {
  return variant === "secondary" ||
    variant === "ghost" ||
    variant === "danger"
    ? "raised"
    : undefined;
}

/**
 * Everything that makes an element look and theme like a button: the class list,
 * plus the contrast-context attributes the theme generator reads.
 *
 * Exported because a link is not a button. Navigation has to be an anchor to keep
 * middle-click, open-in-new-tab, and the browser's own status bar working, and no
 * amount of `role="button"` gives those back. So a call to action that navigates
 * needs to wear a button's clothes without becoming one:
 *
 *     <Link {...buttonProps({ variant: "primary", size: "lg" })} href="/start">
 *
 * Size and shape are enumerated rather than left to a `className` override for a
 * specific reason: two Tailwind utilities for the same property are resolved by
 * their order in the generated stylesheet, not by which one the caller passed.
 * `rounded-full` layered over `rounded-[var(--radius-sm)]` is a coin toss. So
 * anything that legitimately varies becomes a named option, and `className` stays
 * for properties this primitive does not already set.
 */
export function buttonProps({
  variant = "primary",
  size = "md",
  shape = "default",
  className = "",
}: ButtonAppearance = {}) {
  return {
    className: `${base} ${shapes[shape]} ${sizes[size]} ${variants[variant]} ${className}`,
    "data-contrast-context": contrastContext(variant),
    "data-contrast-hover-context": contrastHoverContext(variant),
  };
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  shape = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      {...buttonProps({ variant, size, shape, className })}
    />
  );
}

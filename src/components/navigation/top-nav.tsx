import type { ReactNode } from "react";
import Link from "next/link";
import { LotusMark } from "@/components/ui/lotus-mark";

type TopNavProps = {
  authenticated: boolean;
  current: "dashboard" | "components";
  action?: ReactNode;
};

const destinations = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard" },
  { href: "/components", label: "Components", key: "components" },
] as const;

const baseButton =
  "inline-flex min-h-10 shrink-0 items-center rounded-[var(--radius-sm)] px-3 text-sm font-semibold shadow-[var(--shadow-sm)] sm:px-4";

export function TopNav({
  authenticated,
  current,
  action,
}: TopNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-8 sm:px-10"
    >
      <Link
        href="/"
        aria-label="Padma home"
        className="flex shrink-0 items-center gap-2.5 font-semibold"
      >
        <LotusMark className="size-7 text-primary" />
        <span className="hidden sm:inline">Padma</span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        {destinations.map((destination) => {
          if (destination.key === "dashboard" && !authenticated) {
            return null;
          }

          const active = current === destination.key;

          return (
            <Link
              key={destination.key}
              href={destination.href}
              aria-current={active ? "page" : undefined}
              data-contrast-context={active ? undefined : "surface"}
              data-contrast-hover-context={active ? undefined : "raised"}
              className={
                active
                  ? `${baseButton} bg-primary text-primary-foreground hover:bg-primary-hover`
                  : `${baseButton} border border-border bg-surface hover:bg-surface-raised`
              }
            >
              {destination.label}
            </Link>
          );
        })}

        {action ??
          (!authenticated && (
            <Link
              href="/sign-in"
              data-contrast-context="surface"
              data-contrast-hover-context="raised"
              className={`${baseButton} border border-border bg-surface hover:bg-surface-raised`}
            >
              Sign in
            </Link>
          ))}
      </div>
    </nav>
  );
}

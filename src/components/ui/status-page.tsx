import Link from "next/link";
import { Card } from "./card";

type StatusPageProps = {
  code: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function StatusPage({
  code,
  title,
  description,
  actionHref = "/",
  actionLabel = "Return home",
}: StatusPageProps) {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[75vh] w-full max-w-2xl items-center px-6 py-20"
    >
      <Card className="w-full p-8 sm:p-10">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            data-contrast-context="raised"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-raised font-mono text-xs font-bold text-primary"
          >
            {code}
          </span>
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Request status
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
          </div>
        </div>
        <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
          {description}
        </p>
        <Link
          href={actionHref}
          className="mt-8 inline-flex min-h-10 items-center rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          {actionLabel}
        </Link>
      </Card>
    </main>
  );
}

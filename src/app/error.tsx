"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ErrorBoundary({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[75vh] w-full max-w-2xl items-center px-6 py-20">
      <Card
        role="alert"
        aria-labelledby="application-error-title"
        className="w-full p-8 sm:p-10"
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-danger/10 font-mono text-xs font-bold text-danger"
          >
            500
          </span>
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-danger">
              Unexpected error
            </p>
            <h1
              id="application-error-title"
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Something went wrong.
            </h1>
          </div>
        </div>
        <p className="mt-6 text-base leading-7 text-muted sm:text-lg sm:leading-8">
          The failure was contained by an error boundary. Try the operation
          again, and use the correlation digest when reporting a persistent
          issue.
        </p>
        {error.digest && (
          <div
            data-contrast-context="raised"
            className="mt-5 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-4 py-3"
          >
            <p className="text-xs font-semibold text-muted">
              Correlation digest
            </p>
            <code className="mt-1 block overflow-x-auto font-mono text-xs">
              {error.digest}
            </code>
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={unstable_retry}>Try again</Button>
          <Link
            href="/"
            data-contrast-context="surface"
            data-contrast-hover-context="raised"
            className="inline-flex min-h-10 items-center rounded-[var(--radius-sm)] border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-raised"
          >
            Return home
          </Link>
        </div>
      </Card>
    </main>
  );
}

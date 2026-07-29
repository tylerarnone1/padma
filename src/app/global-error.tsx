"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root application error", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-background text-foreground">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-20">
          <div
            role="alert"
            aria-labelledby="root-error-title"
            data-contrast-context="card"
            className="w-full rounded-2xl border border-border bg-card-surface p-8 sm:p-10"
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-full border border-border font-mono text-xs font-bold text-danger"
              >
                500
              </span>
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-danger">
                  Root error
                </p>
                <h1
                  id="root-error-title"
                  className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
                >
                  The application could not recover.
                </h1>
              </div>
            </div>
            <p className="mt-6 text-base leading-7 text-muted sm:text-lg">
              The root error boundary contained an unexpected failure. Retry
              the page before reporting a persistent issue.
            </p>
            {error.digest && (
              <p className="mt-4 font-mono text-xs text-muted">
                Digest: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={unstable_retry}
              className="mt-8 min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}

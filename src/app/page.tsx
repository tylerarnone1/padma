import Link from "next/link";
import { Card } from "@/components/ui/card";
import { LotusBloom } from "@/components/ui/lotus-bloom";
import { KineticText } from "@/components/ui/kinetic-text";
import { LotusMark } from "@/components/ui/lotus-mark";
import { getCurrentSession } from "@/lib/auth/session";

/**
 * Each petal of the bloom stands for one foundation. The order matches the
 * scroll choreography in `globals.css`: petal 01 is the one the camera dives
 * into, and the bloom moves into the right column from petal 02 onward.
 */
const foundations = [
  {
    number: "01",
    title: "Default deny, everywhere",
    description:
      "Authentication never implies authorization. Every page, route handler, and server action revalidates the real session and the explicit permission it needs. Each feature must declare ownership and enforce access before revealing a record.",
  },
  {
    number: "02",
    title: "Passwordless identity with real step-up",
    description:
      "OAuth-only sign-in, revocable sessions, and TOTP that is actually enforced. Operations touching credentials, access, billing, or secrets require recent MFA, not a flag set once at signup.",
  },
  {
    number: "03",
    title: "Integrations that survive retries",
    description:
      "Domain state and its outbox event commit in one transaction, so nothing is announced that did not happen. Consumers are idempotent, webhooks are signed and SSRF-checked, and exhausted deliveries surface instead of retrying forever.",
  },
  {
    number: "04",
    title: "Legible to the next agent",
    description:
      "Stated invariants, vertical feature slices, decision records, and tests that encode intent. The structure is designed so a coding agent extends the pattern instead of quietly inventing a weaker one.",
  },
] as const;

const HERO_HEADLINE = "Foundations open one layer at a time.";
const CLOSING_HEADLINE = "Every layer, in one place";

export default async function Home() {
  const session = await getCurrentSession();
  const primaryHref = session ? "/dashboard" : "/sign-in";
  const primaryLabel = session ? "Open dashboard" : "Sign in";

  return (
    <main className="flex w-full flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8 sm:px-10">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <LotusMark className="size-8 text-primary" />
          Padma
        </Link>
        <Link
          href={primaryHref}
          data-contrast-context="surface"
          data-contrast-hover-context="raised"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold shadow-[var(--shadow-sm)] hover:bg-surface-raised"
        >
          {primaryLabel}
        </Link>
      </nav>

      {/*
       * The bloom is pinned behind this track while the beats scroll over it.
       * Without scroll-driven animation support the same markup renders as a
       * static bloom above normally stacked sections.
       */}
      <section className="padma-track">
        <LotusBloom />

        {/*
         * Full width, not a centred column: the bloom grows large enough to be
         * cropped by the right edge, so the copy needs the true left edge of the
         * viewport rather than the inside of a max-width container.
         */}
        <div className="padma-beats w-full px-6 sm:px-10 lg:px-20">
          {/*
           * The hero is deliberately bare: a mark, a line, and the headline in
           * the lower left, with the furled bud holding the upper frame. The
           * calls to action live in the nav and in the closing section.
           */}
          <div className="padma-beat" data-align="left" data-beat="hero">
            <div>
              <p className="padma-char font-mono text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                <span>Secure by default · legible by design</span>
              </p>
              <h1
                className="padma-headline mt-6 font-semibold tracking-[-0.045em]"
                aria-label={HERO_HEADLINE}
              >
                <KineticText text={HERO_HEADLINE} />
              </h1>
            </div>
          </div>

          <div className="padma-beat" data-align="center" data-beat="thesis">
            <div className="padma-reveal mx-auto">
              <p className="font-mono text-[clamp(0.7rem,0.8vw,1rem)] font-semibold uppercase tracking-[0.22em] text-primary">
                The thesis
              </p>
              <p className="mx-auto mt-7 max-w-[34ch] text-[clamp(1.35rem,2.1vw,2.9rem)] leading-[1.35]">
                Most starters hand you a login form and call it security. The
                expensive parts are the boundaries you cannot retrofit:{" "}
                <span className="text-primary">authorization</span>, data
                ownership, auditability, and delivery you can still trust after
                a retry.
              </p>
            </div>
          </div>

          {foundations.map((foundation) => (
            <div
              key={foundation.number}
              className="padma-beat"
              data-align="left"
            >
              <div className="padma-reveal">
                <p className="font-mono text-[clamp(0.8rem,0.95vw,1.25rem)] font-semibold text-primary">
                  {foundation.number}
                </p>
                <h2
                  className="mt-5 max-w-[17ch] text-[clamp(2rem,3.1vw,4.25rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-primary"
                  data-kinetic="scroll"
                  aria-label={foundation.title}
                >
                  <KineticText text={foundation.title} />
                </h2>
                <p className="mt-6 max-w-[46ch] text-[clamp(1.05rem,1.2vw,1.7rem)] leading-[1.6] text-muted">
                  {foundation.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="foundations"
        className="mx-auto w-full max-w-6xl border-t border-border px-6 py-24 sm:px-10"
      >
        <h2
          className="text-[clamp(2rem,2.6vw,3.5rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
          data-kinetic="scroll"
          aria-label={CLOSING_HEADLINE}
        >
          <KineticText text={CLOSING_HEADLINE} />
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
          The invariants above are enforced in code, proven by tests, and
          documented as decision records you can argue with.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {foundations.map((foundation) => (
            <Card key={foundation.number}>
              <p className="font-mono text-xs text-primary">
                {foundation.number}
              </p>
              <h3 className="mt-4 text-xl font-semibold">{foundation.title}</h3>
              <p className="mt-2 leading-7 text-muted">
                {foundation.description}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-4">
          <Link
            href={primaryHref}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sm)] hover:bg-primary-hover"
          >
            {session ? "Continue building" : "Start securely"}
          </Link>
          <p className="text-sm text-muted">
            The motion on this page ships no client JavaScript.
          </p>
        </div>
      </section>
    </main>
  );
}

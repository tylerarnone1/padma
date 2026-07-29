import Link from "next/link";
import { BeatRail } from "@/components/ui/beat-rail";
import { Card } from "@/components/ui/card";
import { LotusBloom } from "@/components/ui/lotus-bloom";
import { KineticText } from "@/components/ui/kinetic-text";
import { LotusMark } from "@/components/ui/lotus-mark";
import { WordCycler } from "@/components/ui/word-cycler";
import { getCurrentSession } from "@/lib/auth/session";

/**
 * Each petal of the bloom stands for one foundation. The order matches the
 * scroll choreography in `landing.css`: petal 01 is the one the camera dives
 * into, and the bloom moves into the right column from petal 02 onward.
 *
 * `rail` is the short form the beat rail shows beside its step. The full title
 * is too long to sit in a viewport margin.
 */
const foundations = [
  {
    number: "01",
    rail: "Default deny",
    title: "Default deny, everywhere",
    description:
      "Authentication never implies authorization. Every page, route handler, and server action revalidates the real session and the explicit permission it needs. Each feature must declare ownership and enforce access before revealing a record.",
  },
  {
    number: "02",
    rail: "Identity",
    title: "Passwordless identity with real step-up",
    description:
      "OAuth-only sign-in, revocable sessions, and TOTP that is actually enforced. Operations touching credentials, access, billing, or secrets require recent MFA, not a flag set once at signup.",
  },
  {
    number: "03",
    rail: "Integrations",
    title: "Integrations that survive retries",
    description:
      "Domain state and its outbox event commit in one transaction, so nothing is announced that did not happen. Consumers are idempotent, webhooks are signed and SSRF-checked, and exhausted deliveries surface instead of retrying forever.",
  },
  {
    number: "04",
    rail: "Legibility",
    title: "Legible to the next agent",
    description:
      "Stated invariants, vertical feature slices, decision records, and tests that encode intent. The structure is designed so a coding agent extends the pattern instead of quietly inventing a weaker one.",
  },
] as const;

const HERO_HEADLINE = "Foundations open one layer at a time.";
const CLOSING_HEADLINE = "Every layer, in one place";
const REPOSITORY_URL = "https://github.com/tylerarnone1/padma";

/**
 * The rotating term in the hero eyebrow: the boundaries the thesis below argues
 * cannot be retrofitted. Exactly five, because `landing.css` assigns one delay
 * per `:nth-child` slot and five is what it declares.
 */
const CYCLED_TERMS = [
  "authorization",
  "data ownership",
  "audit trails",
  "step-up MFA",
  "retry safety",
] as const;

/** Counts that come from the repository contract, not from marketing. */
const STATS = [
  {
    value: "13",
    label:
      "stated security invariants, each enforced in code and covered by a test",
  },
  {
    value: "9",
    label:
      "ordered steps in every protected mutation, from request correlation to a problem response",
  },
  {
    value: "0",
    label:
      "JavaScript-driven animations on this page — every frame of its motion is CSS, read from the scroll position by the compositor",
  },
] as const;

const SETUP_COMMANDS = [
  "npm install",
  "copy .env.example .env",
  "npm run dev",
  "npm run generate:feature -- your-feature",
] as const;

/**
 * The beat rail's steps, in scroll order. Six of them, which is exactly what
 * `landing.css` declares keyframes for: one per viewport-tall beat of the pinned
 * track.
 */
const BEATS = [
  { id: "beat-overview", label: "Overview" },
  { id: "beat-thesis", label: "The thesis" },
  ...foundations.map((foundation) => ({
    id: `beat-${foundation.number}`,
    label: foundation.rail,
  })),
] as const;

export default async function Home() {
  const session = await getCurrentSession();
  const primaryHref = session ? "/dashboard" : "/sign-in";
  const primaryLabel = session ? "Open dashboard" : "Sign in";

  return (
    <>
      {/*
       * The ambient field, behind every section. It answers the one thing
       * scroll-driven motion cannot: what the page does while nobody is
       * scrolling. Fixed and decorative, so it costs no layout.
       */}
      <div className="padma-atmosphere" aria-hidden="true">
        <span className="padma-aurora" />
        <span className="padma-aurora" />
        <span className="padma-aurora" />
        <span className="padma-weave" />
      </div>

      {/* Outside `main`, so the layout's skip link genuinely skips it. */}
      <header className="padma-nav">
        <nav
          aria-label="Primary"
          className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-10"
        >
          <Link
            href="/"
            className="padma-brand flex items-center gap-3 font-semibold"
          >
            <LotusMark className="size-8 text-primary" />
            Padma
          </Link>
          <div className="flex items-center gap-2">
            <Link href={REPOSITORY_URL} className="padma-cta padma-cta-primary">
              View on GitHub
            </Link>
            <Link
              href={primaryHref}
              data-contrast-context="surface"
              data-contrast-hover-context="raised"
              className="padma-cta padma-cta-quiet hidden sm:inline-flex"
            >
              {primaryLabel}
            </Link>
          </div>
        </nav>
      </header>

      <main id="main-content" className="flex w-full flex-1 flex-col">
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
             * The hero is deliberately bare: a status line, the headline in the
             * lower left, and a cue, with the furled bud holding the upper frame.
             * The calls to action live in the nav and in the closing section.
             */}
            <div
              className="padma-beat"
              data-align="left"
              data-beat="hero"
              id="beat-overview"
            >
              <div>
                <p className="padma-eyebrow padma-hero-aside">
                  <span className="padma-live">
                    <span className="padma-live-dot" aria-hidden="true" />
                    Secure by default
                  </span>
                  <span aria-hidden="true" className="opacity-45">
                    ·
                  </span>
                  <span className="padma-eyebrow-phrase">
                    built for
                    <WordCycler
                      words={CYCLED_TERMS}
                      label={`built for ${CYCLED_TERMS.join(", ")}`}
                    />
                  </span>
                </p>
                <h1
                  className="padma-headline mt-6 font-semibold tracking-[-0.045em]"
                  aria-label={HERO_HEADLINE}
                >
                  <KineticText text={HERO_HEADLINE} />
                </h1>
                <p className="padma-cue" aria-hidden="true">
                  <span className="padma-cue-track">
                    <span className="padma-cue-dot" />
                  </span>
                  <span>Scroll to open</span>
                </p>
              </div>
            </div>

            <div
              className="padma-beat"
              data-align="center"
              data-beat="thesis"
              id="beat-thesis"
            >
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
                id={`beat-${foundation.number}`}
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

          {/*
           * The rail is a sibling of the copy rather than a child of it, so it
           * paints above the bloom — which crosses into the right column and
           * would otherwise cover it. It stays inside the track because that is
           * where the `--padma-bloom` timeline is declared, and it is fixed so it
           * adds no height to the track and cannot disturb the beat arithmetic
           * its own ranges depend on. It also carries the page's reading
           * progress, vertically, along the same axis the reader is travelling.
           */}
          <BeatRail beats={BEATS} />
        </section>

        <section
          id="foundations"
          className="padma-seam mx-auto w-full max-w-6xl px-6 py-24 sm:px-10"
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

          <ul className="mt-14 grid list-none gap-9 sm:grid-cols-3">
            {STATS.map((stat) => (
              <li key={stat.value} className="padma-stat">
                <span className="padma-stat-value">{stat.value}</span>
                <span className="padma-stat-label">{stat.label}</span>
              </li>
            ))}
          </ul>

          <div className="padma-foundation-grid mt-14">
            {foundations.map((foundation) => (
              <Card
                key={foundation.number}
                className="padma-foundation"
                data-number={foundation.number}
              >
                <p className="padma-foundation-number">{foundation.number}</p>
                <h3 className="mt-4 text-xl font-semibold">
                  {foundation.title}
                </h3>
                <p className="mt-2 leading-7 text-muted">
                  {foundation.description}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-6">
            <Link
              href={REPOSITORY_URL}
              className="padma-cta padma-cta-primary padma-cta-lg"
            >
              Use the GitHub template
            </Link>
            <Link href={primaryHref} className="padma-arrow">
              <span>
                {session ? "Continue building" : "Explore the local demo"}
              </span>
              <span className="padma-arrow-glyph" aria-hidden="true">
                →
              </span>
            </Link>
          </div>

          <div id="get-started" className="padma-seam mt-20 scroll-mt-24 pt-14">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Start building
            </p>
            <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  Use this repository as a GitHub template.
                </h2>
                <p className="mt-4 max-w-xl leading-7 text-muted">
                  Clone your copy, start the guarded local environment, then
                  generate the first product feature. The repository contract
                  makes ownership, permissions, trust boundaries, audit, and
                  retries questions your coding agent must answer before it
                  writes the feature.
                </p>
              </div>
              <div className="padma-term" data-contrast-context="raised">
                <div className="padma-term-bar" aria-hidden="true">
                  <span className="padma-term-lamp" />
                  <span className="padma-term-lamp" />
                  <span className="padma-term-lamp" />
                  <span className="padma-term-title">your-product</span>
                </div>
                <ol className="padma-term-body">
                  {SETUP_COMMANDS.map((command, index) => (
                    <li key={command} className="padma-term-line">
                      <span className="padma-term-prompt" aria-hidden="true">
                        $
                      </span>
                      <code>
                        {command}
                        {index === SETUP_COMMANDS.length - 1 ? (
                          <span className="padma-caret" aria-hidden="true" />
                        ) : null}
                      </code>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="padma-seam">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-10 sm:px-10">
          <Link
            href="/"
            className="padma-brand flex items-center gap-3 text-sm font-semibold"
          >
            <LotusMark className="size-6 text-primary" />
            Padma
          </Link>
          <p className="text-sm text-muted">
            Every animation on this page is CSS. Nothing here is driven by a
            scroll listener.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/components" className="padma-arrow">
              <span>Component gallery</span>
              <span className="padma-arrow-glyph" aria-hidden="true">
                →
              </span>
            </Link>
            <Link href={REPOSITORY_URL} className="padma-arrow">
              <span>GitHub</span>
              <span className="padma-arrow-glyph" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}

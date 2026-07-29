"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

export type Beat = {
  readonly id: string;
  readonly label: string;
};

/**
 * The landing page's section rail: a vertical spine, one station per beat, and a
 * fill that reports reading position. `landing.css` owns all of that.
 *
 * This is the only part of the page that needs client JavaScript, and it is worth
 * being exact about why. CSS cannot time a scroll: `scroll-behavior` accepts only
 * `auto | smooth`, and the browser then picks a duration that is close to constant
 * no matter how far it is going. A jump across the whole track and a hop to the
 * next beat get the same budget.
 *
 * That is not only a matter of feel here, and it is the thing to understand before
 * changing any number below. The scroll position is what the bloom's camera is
 * keyed to, so scroll speed *is* animation playback speed. A constant-duration
 * scroll therefore plays the choreography at a different rate depending on how far
 * the reader asked to go — cross the whole track and the lotus spins like a thrown
 * blade. Everything here exists to hold one traversal rate: duration proportional
 * to distance, and a speed profile that does not spike in the middle.
 *
 * What it deliberately is not:
 *
 * - It animates the *scroll position*, never an element. Every frame of the
 *   page's own motion is still CSS, read from that position by the compositor.
 * - It installs no scroll listener. The input listeners below are attached for
 *   the duration of one animation and exist only to surrender it.
 * - It is an enhancement, not the mechanism. Without JavaScript these are six
 *   ordinary anchors to six real element ids: the rail still navigates and simply
 *   loses its easing.
 */

/**
 * Time to travel one beat. This is the whole tuning knob: one second per section,
 * always, however far the journey is.
 *
 * It has to be a *rate* rather than a duration, because on this page the scroll
 * position is not merely where the reader is — it is the clock the bloom's camera
 * is keyed to. Scroll speed and animation playback speed are the same number. Give
 * a five-beat jump the duration of a one-beat jump and you have not just moved
 * faster, you have played five beats of choreography in the time one should take,
 * and the lotus spins through three hundred and seventy degrees in a second and a
 * half. Proportional duration is what keeps the choreography playing at one rate
 * no matter which step was clicked.
 *
 * The track is six viewport-tall beats, so the longest journey available is five
 * of them, which bounds this at five seconds without needing a ceiling. A ceiling
 * is exactly the sub-linearity being removed here.
 */
const MS_PER_BEAT_TRAVELLED = 1000;

/** Floor, so clicking the step you are already nearly at is still a movement. */
const MINIMUM_DURATION_MS = 450;

/**
 * Share of the journey spent accelerating, and again decelerating. Everything
 * between is travelled at one constant speed.
 */
const RAMP_SHARE = 0.25;

/**
 * Input that means the reader has taken over and the animation should stop.
 *
 * Typed as plain strings rather than `keyof WindowEventMap`: passing a union of
 * event names to `addEventListener` makes TypeScript intersect the overloads and
 * reject the listener, and nothing here needs the narrowed event type.
 */
const SURRENDER_EVENTS: readonly string[] = ["wheel", "touchstart", "keydown"];

/**
 * Teardown for the animation currently in flight, if any.
 *
 * Module scope, because the competing animation to worry about is the one started
 * by the reader's *previous* click. Two easing loops both calling `scrollTo` on
 * the same frame fight each other, and the visible result is a stutter that looks
 * like dropped frames rather than like a bug. A new journey always ends the old
 * one first.
 */
let abandonJourneyInFlight: (() => void) | null = null;

/**
 * A trapezoidal speed profile: ease out of rest, hold one speed, ease into rest.
 *
 * Not an ease-in-out curve, and for the same reason the duration is proportional.
 * Ease-in-out cubic peaks at three times its own average speed halfway through,
 * and here that peak is not a detail of the feel — it is three times the rotation
 * speed of the bloom. Even a correctly-timed journey blurs in the middle. Holding
 * a constant rate between the ramps caps the peak at `1 / (1 - RAMP_SHARE)`, or
 * 1.33 times average, which is the difference between travelling and being
 * thrown.
 *
 * The ramps are quadratic, so speed is continuous at both joins and the journey
 * neither jerks off the mark nor slams into the destination.
 */
function trapezoidalProgress(elapsed: number): number {
  /* Constant-phase speed. The ramps each cover half the ground a constant phase
     of the same length would, so the held speed has to make up the difference. */
  const heldSpeed = 1 / (1 - RAMP_SHARE);

  if (elapsed < RAMP_SHARE) {
    return (heldSpeed * elapsed ** 2) / (2 * RAMP_SHARE);
  }

  if (elapsed > 1 - RAMP_SHARE) {
    const remaining = 1 - elapsed;
    return 1 - (heldSpeed * remaining ** 2) / (2 * RAMP_SHARE);
  }

  return heldSpeed * (RAMP_SHARE / 2 + elapsed - RAMP_SHARE);
}

/** Strictly proportional to distance, so the traversal rate never changes. */
function durationFor(distance: number, viewportHeight: number): number {
  const beatsTravelled = Math.abs(distance) / Math.max(viewportHeight, 1);

  return Math.max(MINIMUM_DURATION_MS, beatsTravelled * MS_PER_BEAT_TRAVELLED);
}

function travelTo(target: HTMLElement, id: string): void {
  abandonJourneyInFlight?.();

  const from = window.scrollY;
  const distance = Math.round(target.getBoundingClientRect().top);

  /*
   * `replaceState` rather than assigning `location.hash`: setting the hash
   * scrolls, which would undo the animation with a jump on the final frame. It
   * still leaves a shareable, reloadable URL, and unlike `pushState` it does not
   * put six entries in the reader's history for six clicks.
   */
  const recordPosition = () => {
    window.history.replaceState(null, "", `#${id}`);
  };

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  /*
   * `instant`, never `auto`. `auto` defers to the CSS `scroll-behavior`, which
   * `globals.css` sets to `smooth` — so an unqualified scroll here would hand the
   * job straight back to the browser's own animation. That is the bug this whole
   * component exists to avoid, and in the loop below it would mean every frame
   * starting a competing smooth scroll of its own.
   */
  if (prefersReducedMotion || distance === 0) {
    window.scrollTo({ top: from + distance, behavior: "instant" });
    recordPosition();
    return;
  }

  const duration = durationFor(distance, window.innerHeight);
  const startedAt = performance.now();
  let frame = 0;
  let abandoned = false;

  const abandon = () => {
    abandoned = true;
    cancelAnimationFrame(frame);
    for (const name of SURRENDER_EVENTS) {
      window.removeEventListener(name, abandon);
    }
    if (abandonJourneyInFlight === abandon) {
      abandonJourneyInFlight = null;
    }
  };

  for (const name of SURRENDER_EVENTS) {
    window.addEventListener(name, abandon, { passive: true });
  }
  abandonJourneyInFlight = abandon;

  const step = (now: number) => {
    if (abandoned) {
      return;
    }

    const elapsed = Math.min((now - startedAt) / duration, 1);
    window.scrollTo({
      top: from + distance * trapezoidalProgress(elapsed),
      behavior: "instant",
    });

    if (elapsed < 1) {
      frame = requestAnimationFrame(step);
      return;
    }

    /*
     * Arrived. Tear down first, then record — the reader never took over, so the
     * beat they asked for is the truth. When they *do* take over, `abandon` runs
     * without this and the URL keeps pointing at wherever they stopped caring.
     */
    abandon();
    recordPosition();
  };

  frame = requestAnimationFrame(step);
}

function handleClick(event: MouseEvent<HTMLAnchorElement>, id: string): void {
  /*
   * Modified and non-primary clicks belong to the browser: open in a new tab,
   * open in a new window, and so on. Hijacking them would be a bug.
   */
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.defaultPrevented
  ) {
    return;
  }

  /*
   * Resolved before `preventDefault`, not after. If the beat is somehow not in
   * the document, the right outcome is the anchor's own navigation — swallowing
   * the click and doing nothing would be strictly worse than the default.
   */
  const target = document.getElementById(id);

  if (!target) {
    return;
  }

  event.preventDefault();
  travelTo(target, id);
}

export function BeatRail({ beats }: { beats: readonly Beat[] }) {
  return (
    <nav className="padma-rail" aria-label="Foundations">
      {/* Behind the stations, so a dot reads as a point on the line rather than
          beside it. `landing.css` raises the steps above it; the order here is
          for reading, and its `:nth-of-type` rules do not depend on it. */}
      <span className="padma-rail-spine" aria-hidden="true">
        <span className="padma-rail-fill" />
      </span>

      {beats.map((beat) => (
        <Link
          key={beat.id}
          href={`#${beat.id}`}
          className="padma-rail-step"
          onClick={(event) => handleClick(event, beat.id)}
        >
          <span className="padma-rail-mark" aria-hidden="true" />
          <span className="padma-rail-label">{beat.label}</span>
        </Link>
      ))}
    </nav>
  );
}

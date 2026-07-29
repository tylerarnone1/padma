"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * How long the panel survives the pointer leaving the popover.
 *
 * Long enough to cross the gap between trigger and panel, or to overshoot and
 * come back, without the thing shutting in your face. Short enough that a panel
 * you have walked away from is gone by the time you look again.
 */
const DEFAULT_CLOSE_DELAY_MS = 1500;

type PopoverProps = {
  /**
   * Accessible name for the trigger. Applied as `aria-label`, so `trigger` is
   * free to be purely visual — and should be, since a name assembled from an
   * icon and a truncated label is not one.
   */
  label: string;
  /** Visual content of the trigger button. */
  trigger: ReactNode;
  /** Panel content. */
  children: ReactNode;
  /** Classes for the trigger button: shape, surface, typography. */
  triggerClassName?: string;
  /**
   * Classes for the panel: placement, size, surface. Placement is the caller's
   * because this primitive does no measuring — see the note on the component.
   */
  panelClassName?: string;
  /** Grace period after the pointer leaves before the panel closes. */
  closeDelayMs?: number;
};

/**
 * A disclosure: a button, and a panel it shows.
 *
 * "Popover" is the common name; in ARIA terms this is a *disclosure* rather than
 * a menu, which is why the trigger carries `aria-expanded` and `aria-controls`
 * and not `aria-haspopup`. Anything that lists actions to choose between wants
 * menu semantics and keyboard arrow navigation, which this deliberately is not.
 *
 * What it owns: open state, dismissal, and the accessibility contract. Opening
 * takes a click, so a panel never ambushes a pointer merely crossing the trigger.
 * Closing happens on a grace timer once the pointer leaves, immediately on
 * Escape, on an outside press, or on a second click of the trigger.
 *
 * What it does not own is placement. There is no measuring, no collision
 * detection, no flipping when it would overflow the viewport — the caller says
 * where the panel goes with `panelClassName`. Doing it properly means either a
 * positioning library or CSS anchor positioning, and pretending otherwise with a
 * half-implemented `placement` prop would be worse than an honest seam.
 *
 * Styling contract for callers: the root exposes `group` and `data-open`, so
 * trigger content can react to state with `group-data-[open=true]:…` and to the
 * pointer with `group-hover:…`. The panel's own transition is not overridable,
 * because two competing Tailwind classes for one property resolve by stylesheet
 * order rather than by which was passed in.
 *
 * This is not built on `<details>`. Native disclosure hands you keyboard and
 * touch behaviour for free, but its `open` attribute cannot be set from CSS or
 * held open by a timer, so hover and a delayed close were never expressible
 * through it — and two sources of truth for one panel costs more than the
 * `aria-expanded`, Escape, and outside-press handling below.
 */
export function Popover({
  label,
  trigger,
  children,
  triggerClassName = "",
  panelClassName = "",
  closeDelayMs = DEFAULT_CLOSE_DELAY_MS,
}: PopoverProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeNow = useCallback(() => {
    cancelScheduledClose();
    setOpen(false);
  }, [cancelScheduledClose]);

  const closeAfterGrace = useCallback(() => {
    cancelScheduledClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, closeDelayMs);
  }, [cancelScheduledClose, closeDelayMs]);

  // A pending close must not fire into an unmounted component.
  useEffect(() => cancelScheduledClose, [cancelScheduledClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    /*
     * `pointerdown`, not `click`: dismissing on press is what a touch user
     * expects, and it lands before the pressed element can move under a finger.
     */
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeNow();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeNow();
        // Escape has to leave focus somewhere predictable, not on a hidden panel.
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeNow]);

  return (
    <div
      ref={rootRef}
      data-open={open}
      className="group relative inline-flex"
      /*
       * Gated on the pointer being a mouse. A tap raises enter and leave too, so
       * without this a touch user would arm a timer that closes the panel they
       * just opened, having never left anything. It is also what keeps the whole
       * hover behaviour additive rather than load-bearing.
       */
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          cancelScheduledClose();
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          closeAfterGrace();
        }
      }}
      // Focus moving between the panel's own controls raises blur then focus in
      // one tick, so the schedule is cancelled before it can ever elapse.
      onFocus={cancelScheduledClose}
      onBlur={closeAfterGrace}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeNow() : setOpen(true))}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        data-contrast-context="surface"
        data-contrast-hover-context="raised"
        className={triggerClassName}
      >
        {trigger}
      </button>

      <div
        id={panelId}
        inert={!open}
        data-contrast-context="card"
        /*
         * Kept mounted so it can animate both ways. `inert` takes it out of the
         * accessibility tree and the tab order; `pointer-events` is the same
         * guarantee for the pointer, in browsers that lack `inert` and as the
         * defence against the classic invisible-but-clickable overlay.
         */
        className={`pointer-events-none absolute translate-y-2 opacity-0 transition-[opacity,translate] duration-200 ease-out group-data-[open=true]:pointer-events-auto group-data-[open=true]:translate-y-0 group-data-[open=true]:opacity-100 ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

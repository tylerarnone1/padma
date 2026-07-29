/**
 * The animated Padma bloom.
 *
 * This renders geometry only. Every motion beat — rising out of shadow, opening,
 * the zoom onto the focused petal, the move into the right column, and the
 * rotation that carries the reader between sections — is expressed as CSS
 * scroll-driven animation in `landing.css`.
 *
 * Alongside that scroll choreography the scene has an ambient layer that runs
 * whether or not anybody scrolls: `.padma-orbit` breathes, ripples leave the
 * receptacle, and motes drift up through the frame. The breath deliberately sits
 * on its own wrapper rather than on `.padma-stage`, because the scroll camera
 * owns the stage's `transform` and two animations cannot share one property.
 *
 * Two deliberate constraints shape the markup:
 *
 * 1. No client JavaScript. There is no `use client`, no scroll listener, and no
 *    hydration cost; the scroll position is read by the compositor.
 * 2. No inline `style` attributes. The production CSP sets
 *    `style-src 'self' 'nonce-…'` with no `'unsafe-inline'`, so per-petal values
 *    are assigned by `:nth-child` rules in the stylesheet instead of props.
 *
 * The bloom is decorative; it is hidden from assistive technology and every
 * statement it illustrates is also present as real text in the page copy.
 */

/**
 * A lotus petal: broad and cupped through the lower body, with the recurved
 * tip found in Indian lotus ornament. It is hinged at the base of its 60x112
 * box. The second path is a curved vein rather than a concentric inset, which
 * keeps tightly furled petals from stacking into one dark central almond.
 */
/*
 * The tip leans right, folds back, and then swells into the petal's shoulder.
 * Rotating that small hook around each whorl produces the layered, round bulb
 * of a furled lotus instead of a ring of flat blades meeting in a seam.
 */
const PETAL_PATH =
  "M30 108C13 105 3 88 4 64C5 43 16 27 27 17C31 13 33 8 33 3C39 10 40 18 36 27C49 35 57 49 57 66C57 88 45 105 30 108Z";
const PETAL_INNER_PATH =
  "M26 95C19 77 20 55 31 37C38 26 39 16 34 7";

/**
 * Petal whorls from the outside in, plus a smaller supporting whorl behind
 * them all.
 *
 * Petal counts are kept low and mutually coprime: a real bud's silhouette is
 * drawn by a handful of broad petals overlapping, not by many narrow blades,
 * and coprime counts stop the rings from lining up into spokes as it turns.
 *
 * The base whorl uses the same recurved petal as the flower. Scaling and angle,
 * rather than a separate spear-shaped leaf, distinguish it from the outer row.
 */
const RINGS = [
  { name: "base", count: 8 },
  { name: "outer", count: 9 },
  { name: "mid", count: 7 },
  { name: "core", count: 5 },
] as const;

function Petal({
  focused,
  gradientId,
}: {
  focused: boolean;
  gradientId: string;
}) {
  return (
    <svg
      className="padma-petal"
      viewBox="0 0 60 112"
      data-petal-focus={focused ? "" : undefined}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0.15"
          x2="1"
          y2="0.85"
        >
          <stop className="padma-depth-shadow" offset="0" />
          <stop className="padma-depth-clear" offset="0.2" />
          <stop className="padma-depth-highlight" offset="0.46" />
          <stop className="padma-depth-clear" offset="0.7" />
          <stop className="padma-depth-shadow-soft" offset="1" />
        </linearGradient>
      </defs>
      <path className="padma-petal-body" d={PETAL_PATH} />
      <path
        className="padma-petal-depth"
        d={PETAL_PATH}
        fill={`url(#${gradientId})`}
      />
      <path className="padma-petal-inner" d={PETAL_INNER_PATH} />
    </svg>
  );
}

/** Expanding rings leaving the receptacle. Three staggered copies of one loop. */
const HALO_COUNT = 3;

/**
 * Drifting motes. Enough of them to be noticed without being looked for, and few
 * enough that each is a cheap composited layer moving only `transform` and
 * `opacity`. Position, drift, size, duration, and phase come from `:nth-child`,
 * which is also why this count and the rules in `landing.css` have to agree.
 */
const MOTE_COUNT = 22;

export function LotusBloom() {
  return (
    <div className="padma-scene" aria-hidden="true">
      <span className="padma-shadow" />

      <div className="padma-perspective">
        <div className="padma-orbit">
          <div className="padma-stage">
            {RINGS.map((ring) => (
              <div key={ring.name} className="padma-ring" data-ring={ring.name}>
                {Array.from({ length: ring.count }, (_, index) => (
                  // The first outer petal is the one the camera dives into.
                  <Petal
                    key={index}
                    gradientId={`padma-${ring.name}-depth-${index}`}
                    focused={ring.name === "outer" && index === 0}
                  />
                ))}
              </div>
            ))}

            <span className="padma-stamen" />

            {/* Inside the stage, so the ripples lie in the flower's own plane
                and tilt with it instead of reading as a flat screen halo. */}
            <span className="padma-halos">
              {Array.from({ length: HALO_COUNT }, (_, index) => (
                <span key={index} className="padma-halo" />
              ))}
            </span>
          </div>
        </div>
      </div>

      {/* Clipped by its own box rather than by the scene: on a wide, short
          viewport the scene is shorter than the bloom, so clipping there would
          crop the flower. */}
      <span className="padma-motes">
        {Array.from({ length: MOTE_COUNT }, (_, index) => (
          <span key={index} className="padma-mote" />
        ))}
      </span>
    </div>
  );
}

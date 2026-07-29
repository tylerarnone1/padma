/**
 * The animated Padma bloom.
 *
 * This renders geometry only. Every motion beat — rising out of shadow, opening,
 * the zoom onto the focused petal, the move into the right column, and the
 * rotation that carries the reader between sections — is expressed as CSS
 * scroll-driven animation in `globals.css`.
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
 * A lotus petal: broad through the middle, tapering to a point, hinged at the
 * base of its 60x112 box. The second path is an inner highlight that keeps the
 * petal reading as a curved surface rather than a flat blade.
 */
/*
 * Obovate, not almond. An almond is pointed at both ends and narrow through the
 * body, so a ring of them furls into a spindle. A lotus petal is broad and
 * rounded with a *rounded* base and only a short taper to the tip, and it is
 * that roundness through the middle that makes a furled bud read as spherical.
 */
const PETAL_PATH =
  "M30 4C43 15 57 35 57 60C57 85 45 105 30 108C15 105 3 85 3 60C3 35 17 15 30 4Z";
const PETAL_INNER_PATH =
  "M30 22C39 31 48 46 48 63C48 82 40 95 30 98C20 95 12 82 12 63C12 46 21 31 30 22Z";

/* Sepals stay narrow and pointed — they are leaves, not petals. */
const SEPAL_PATH = "M30 2C40 26 46 62 30 110C14 62 20 26 30 2Z";
const SEPAL_INNER_PATH = "M30 20C36 38 40 64 30 96C20 64 24 38 30 20Z";

/**
 * Whorls from the outside in, plus the sepal collar that sits behind them all.
 *
 * Petal counts are kept low and mutually coprime: a real bud's silhouette is
 * drawn by a handful of broad petals overlapping, not by many narrow blades,
 * and coprime counts stop the rings from lining up into spokes as it turns.
 *
 * The sepals stay spread even while the flower is furled, which is what a
 * closed lotus actually looks like, and they read as the star-shaped collar at
 * the base of the bud.
 */
const RINGS = [
  { name: "sepal", count: 8, leaf: true },
  { name: "outer", count: 9, leaf: false },
  { name: "mid", count: 7, leaf: false },
  { name: "core", count: 5, leaf: false },
] as const;

function Petal({ focused, leaf }: { focused: boolean; leaf: boolean }) {
  return (
    <svg
      className="padma-petal"
      viewBox="0 0 60 112"
      data-petal-focus={focused ? "" : undefined}
    >
      <path d={leaf ? SEPAL_PATH : PETAL_PATH} />
      <path
        className="padma-petal-inner"
        d={leaf ? SEPAL_INNER_PATH : PETAL_INNER_PATH}
      />
    </svg>
  );
}

export function LotusBloom() {
  return (
    <div className="padma-scene" aria-hidden="true">
      <span className="padma-shadow" />

      <div className="padma-perspective">
        <div className="padma-stage">
          {RINGS.map((ring) => (
            <div key={ring.name} className="padma-ring" data-ring={ring.name}>
              {Array.from({ length: ring.count }, (_, index) => (
                // The first outer petal is the one the camera dives into.
                <Petal
                  key={index}
                  leaf={ring.leaf}
                  focused={ring.name === "outer" && index === 0}
                />
              ))}
            </div>
          ))}

          <span className="padma-stamen" />
        </div>
      </div>
    </div>
  );
}

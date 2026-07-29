/**
 * The Padma wordmark glyph: a five-petal lotus fan.
 *
 * The mark is a single path rotated around a shared hinge point, which is the
 * same construction the animated bloom uses in three dimensions. It paints with
 * `currentColor` only, so every palette and color mode gets a correct mark
 * without the component knowing any palette values.
 *
 * The rotations are `transform` presentation attributes, so the mark is correct
 * with no stylesheet at all. `landing.css` opens the fan wider when the mark sits
 * inside a hovered `.padma-brand` link, which works because a CSS `transform`
 * outranks the attribute — each petal is simply re-declared at a new angle. The
 * `data-petal` index is what lets it address them individually.
 */

const PETAL_PATH = "M16 6C19.6 11.6 19.6 18.4 16 24C12.4 18.4 12.4 11.6 16 6Z";
const HINGE = "16 24";

/** Fan angles paired with the depth cue applied to each petal. */
const PETALS = [
  { angle: -64, opacity: 0.4 },
  { angle: -32, opacity: 0.65 },
  { angle: 0, opacity: 1 },
  { angle: 32, opacity: 0.65 },
  { angle: 64, opacity: 0.4 },
] as const;

export function LotusMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Padma"
      className={`padma-mark ${className}`}
    >
      <g fill="currentColor">
        {PETALS.map((petal, index) => (
          <path
            key={petal.angle}
            d={PETAL_PATH}
            data-petal={index}
            opacity={petal.opacity}
            transform={
              petal.angle === 0 ? undefined : `rotate(${petal.angle} ${HINGE})`
            }
          />
        ))}
      </g>
    </svg>
  );
}

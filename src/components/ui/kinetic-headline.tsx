import { KineticText } from "@/components/ui/kinetic-text";

/**
 * The hero headline: several phrases stacked in one cell, each taking its turn.
 *
 * Every phrase occupies the same grid area, so the block is as tall as the
 * longest one and nothing below it moves as the phrases change. A cycling
 * headline that resized would shove the whole hero around six times a minute.
 *
 * Each phrase is still split by `KineticText`, which buys two things. The words
 * arrive in sequence rather than as a block, because `landing.css` offsets each
 * word's delay by its own index on top of its phrase's. And the characters keep
 * their magnetic hover, so the headline stays playable even while it rotates.
 *
 * The rotation is decorative and hidden from assistive technology. The caller puts
 * one stable phrase on the heading itself as its accessible name — a heading whose
 * text changes every few seconds is worse than useless to a screen reader.
 *
 * The phrase count has to agree with `landing.css`, which declares one delay slot
 * per `:nth-child`, because the production CSP rules out passing an index as an
 * inline `style`.
 */
export function KineticHeadline({ phrases }: { phrases: readonly string[] }) {
  return (
    <span className="padma-headline-cycler" aria-hidden="true">
      {phrases.map((phrase) => (
        <span key={phrase} className="padma-headline-phrase">
          <KineticText text={phrase} />
        </span>
      ))}
    </span>
  );
}

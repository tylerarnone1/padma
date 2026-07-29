import { KineticText } from "@/components/ui/kinetic-text";

/**
 * The hero headline: several phrases stacked in one cell, each taking its turn.
 *
 * Every phrase occupies the same grid area, so the block is as tall as the
 * longest one and nothing below it moves as the phrases change. The rotation
 * is decorative and hidden from assistive technology. The caller puts one
 * stable phrase on the heading itself as its accessible name.
 *
 * The phrase count agrees with the cycle slots in `landing.css`. Character and
 * word sequencing is generated without a fixed limit by `KineticText`.
 */
export function KineticHeadline({
  phrases,
  nonce,
}: {
  phrases: readonly string[];
  nonce: string;
}) {
  return (
    <span className="padma-headline-cycler" aria-hidden="true">
      {phrases.map((phrase) => (
        <span key={phrase} className="padma-headline-phrase">
          <KineticText text={phrase} nonce={nonce} />
        </span>
      ))}
    </span>
  );
}

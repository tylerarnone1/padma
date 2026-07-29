/**
 * A phrase whose last term rotates on a loop.
 *
 * Every word is stacked in one grid cell, so the box is as wide as the longest
 * term and the surrounding line never reflows as the words change. `landing.css`
 * gives each word its turn with a `:nth-child` animation delay, because the
 * production CSP forbids passing one as an inline `style`.
 *
 * The rotation is decorative. It carries no information the reader cannot get
 * from `label`, which is the only thing assistive technology is offered.
 */
export function WordCycler({
  words,
  label,
}: {
  words: readonly string[];
  label: string;
}) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span className="padma-cycler" aria-hidden="true">
        {words.map((word) => (
          <span key={word}>{word}</span>
        ))}
      </span>
    </>
  );
}

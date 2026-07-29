import { Fragment } from "react";

/**
 * Creates numeric-only sequencing rules for exactly the supplied text.
 *
 * Text is deliberately never interpolated into CSS. The production CSP can
 * authorize this stylesheet with its per-request nonce without allowing
 * arbitrary inline style attributes.
 */
export function createKineticSequenceCss(text: string): string {
  const words = text.split(" ");
  const longestWord = words.reduce(
    (longest, word) => Math.max(longest, [...word].length),
    0,
  );
  const wordRules = words.map(
    (_, index) =>
      `.padma-word:nth-child(${index + 1}){--word-i:${index}}`,
  );
  const characterRules = Array.from(
    { length: longestWord },
    (_, index) =>
      `.padma-char:nth-child(${index + 1}){--char-i:${index}}`,
  );

  return [...wordRules, ...characterRules].join("");
}

/**
 * Splits a phrase into per-word and per-character spans so each character can
 * be sequenced independently while words stay unbreakable.
 *
 * Three constraints shape this:
 *
 * 1. No inline `style`. The production CSP has no `'unsafe-inline'`, so
 *    numeric-only `:nth-child` rules are generated in a nonce-authorized style
 *    block instead.
 * 2. Words are wrapped so a line can only break between words, never mid-word.
 * 3. Each character is three nested elements, one per source of motion:
 *
 *      .padma-char        scroll-driven exit
 *        .padma-char-hit  pointer state
 *          span           time-driven entry
 *
 * The caller supplies `aria-label` on the heading, and the split markup is
 * hidden from assistive technology so it is never read out letter by letter.
 */
export function KineticText({
  text,
  nonce,
}: {
  text: string;
  nonce: string;
}) {
  return (
    <>
      <style
        nonce={nonce}
        suppressHydrationWarning
      >
        {createKineticSequenceCss(text)}
      </style>
      <span aria-hidden="true">
        {text.split(" ").map((word, wordIndex) => (
          // A Fragment, not a wrapper element: the word spans have to remain
          // siblings so `:nth-child` can assign their sequence offsets.
          <Fragment key={`${wordIndex}-${word}`}>
            {/* Keep a real breaking opportunity between nowrap word spans. */}
            {wordIndex > 0 ? " " : null}
            <span className="padma-word">
              {[...word].map((character, characterIndex) => (
                <span key={characterIndex} className="padma-char">
                  <span className="padma-char-hit">
                    <span>{character}</span>
                  </span>
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </>
  );
}

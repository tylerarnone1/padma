import { Fragment } from "react";

/**
 * Splits a phrase into per-word and per-character spans so each character can
 * be sequenced independently while words stay unbreakable.
 *
 * Three constraints shape this:
 *
 * 1. No inline `style`. The production CSP sets `style-src 'self' 'nonce-…'`
 *    with no `'unsafe-inline'`, so the per-character sequence index cannot be
 *    passed as a prop. `landing.css` derives it from `:nth-child` instead.
 * 2. Words are wrapped so a line can only break between words, never mid-word.
 *    Characters are `inline-block` to be transformable, and the browser would
 *    otherwise treat every one of them as a break opportunity.
 * 3. Each character is three nested elements, one per source of motion. All
 *    three animate `transform`, so no two of them can share an element:
 *
 *      .padma-char        scroll-driven exit
 *        .padma-char-hit  pointer state — the magnetic hover, transitioned
 *          span           time-driven entry on render
 *
 *    The middle element is what makes hovering a character able to move it at
 *    all: the outer and inner elements both carry animations with `both` fill,
 *    and a filled animation beats any transition on the same property.
 *
 * The caller supplies `aria-label` on the heading, and the split markup is
 * hidden from assistive technology so it is never read out letter by letter.
 */
export function KineticText({ text }: { text: string }) {
  return (
    <span aria-hidden="true">
      {text.split(" ").map((word, wordIndex) => (
        // A Fragment, not a wrapper element: the word spans have to remain
        // siblings or `:nth-child` cannot tell them apart and every word would
        // resolve to the same sequence offset.
        <Fragment key={`${wordIndex}-${word}`}>
          {/* A real space between words, outside the nowrap span, so the line
              still has somewhere to break. */}
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
  );
}

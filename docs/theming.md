# Theming

The theme system has three explicit stages:

1. `src/theme/palettes.ts` contains the canonical Coolors source scales.
2. `src/theme/theme-generator.ts` derives semantic light and dark modes.
3. `src/theme/theme.tsx` exposes typed component references and emits the
   nonce-protected browser runtime.

Change palette colors in `palettes.ts`, not in `globals.css` or a hand-authored
mode map.

## Canonical five-role schema

Every palette uses the same order:

```text
primary dark → primary light → base ← secondary light ← secondary dark
```

Each role contains the complete `100`–`900` shade ladder plus `DEFAULT`.
The theme contract verifies both luminance ramps and requires `DEFAULT` to
equal shade `500`.

Ordering is an authoring contract, not a blind UI mapping. The generator uses
the shared Olive & Earth composition rules:

- light mode uses `base.DEFAULT` as the canvas;
- light mode uses `secondaryLight.DEFAULT` as its bold palette-owned surface;
- the darkest of `primaryDark` and `secondaryDark` becomes the dark anchor;
- dark mode uses anchor shade `400` for the canvas and `DEFAULT` for its
  palette-owned surface;
- raised dark surfaces come from the nearest brighter anchor or companion
  shade; and
- viable accents must have visible boundaries, readable button text, and are
  then ranked by chroma.

This produces consistent structure without pretending that paprika, ink,
forest, and peach have identical behavior.

```tsx
import { theme } from "@/theme/theme";

const panelStyle = {
  color: theme.colors.foreground,
  background: theme.colors.surface,
  borderRadius: theme.radii.large,
};
```

The included palettes are Fiery Ocean, Olive & Earth, Blue Horizon, Rustic
Charm, Autumn Harvest, and Misty Morning. Adding a valid entry to
`paletteSources` automatically generates its modes, selectors, contrast tokens,
preview swatches, and UI option.

The application uses `light` and `dark` as explicit modes. The first visit
follows the operating-system preference. Manual mode and palette choices are
stored under `padma-color-theme` and `padma-color-palette` in local
storage. Both are applied before React hydrates, preventing a flash of the
default theme.

Status colors are intentionally outside the brand palettes. Errors remain red
and successes remain green so their meaning does not change when a palette is
swapped.

## Contrast Guard

`src/theme/contrast-guard.ts` is a theme-compilation guard, not Next.js request
middleware. It checks text against bold surface colors and selects the first
accessible color from the same five-role palette. It may cross to the opposite
luminance ramp—for example, Floral White text on a charcoal Rustic Charm
card—but never creates a sixth primitive or changes the requested background.

The raw `surface` token stays bold for controls and other purposeful emphasis.
`Card` receives a generated `cardSurface`. The universal mutation starts at 76%
of the palette surface blended with 24% of the active canvas; if that result
falls into an inaccessible midtone, Contrast Guard progressively blends it
farther toward the canvas until palette-owned text reaches WCAG AA. This is a
card presentation token, not a sixth palette primitive, and the same rule runs
for every palette in both modes.

Atomic components declare their actual background context once. `Card` carries
`data-contrast-context="card"`; raw surfaces, nested raised regions, and
canvas-colored inputs use `surface`, `raised`, and `background`. The nearest
context supplies foreground, muted, primary, danger, and success text through
generated context variables, so nested backgrounds cannot inherit text
intended for their parent surface. Feature and page code does not need
palette-specific conditions.

Whole-component opacity is intentionally avoided because it fades text and its
background together and therefore cannot reliably repair contrast.

The theme `style` and bootstrap `script` both carry the request's CSP nonce.
Browsers intentionally conceal nonce content attributes after parsing, so those
two elements use narrowly scoped hydration-warning suppression. This does not
remove or weaken the nonce; it prevents React from reporting the browser's
required nonce-hiding behavior as an application mismatch.

Development uses Next.js's documented CSP accommodations: inline styles and
data-backed development fonts are allowed so the development runtime and
tooling can operate. Production does not inherit those allowances; generated
styles remain nonce-protected and fonts remain same-origin.

## Why a small stylesheet remains

`globals.css` is deliberately limited to Tailwind's generated utilities and
browser-level selectors such as focus, selection, transitions, and the page
background. Responsive breakpoints, hover states, and pseudo-elements belong in
a stylesheet because React inline styles cannot express them.

The theme values themselves are emitted from TypeScript in a nonce-protected
`style` element. Using arbitrary inline `style` attributes would require
weakening the production Content Security Policy with `style-src-attr
'unsafe-inline'`, so reusable components should prefer the existing semantic
utilities or a reviewed class over inline styles.

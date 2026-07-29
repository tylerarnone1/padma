/**
 * The visual source of truth for the application.
 *
 * Palette values come from the supplied Coolors sets. Components consume
 * stable semantic references from `theme`; the active palette and color mode
 * only change the values assigned at the document boundary.
 */

import { guardSurfaceContrast } from "./contrast-guard";
import {
  paletteRoleOrder,
  paletteSources,
  type PaletteId,
} from "./palettes";
import {
  generateThemeModes,
  type ThemeColorTokens,
  type ThemeName,
} from "./theme-generator";

export type { PaletteId } from "./palettes";
export type { ThemeName } from "./theme-generator";

export const THEME_STORAGE_KEY = "padma-color-theme";
export const PALETTE_STORAGE_KEY = "padma-color-palette";

type PaletteDefinition = {
  label: string;
  description: string;
  swatches: readonly {
    name: string;
    value: `#${string}`;
  }[];
  modes: Record<ThemeName, ThemeColorTokens>;
};

const sharedTokens = {
  "--radius-sm": "0.5rem",
  "--radius-md": "0.75rem",
  "--radius-lg": "1rem",
  "--font-sans":
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "--font-mono":
    '"SFMono-Regular", Consolas, "Liberation Mono", ui-monospace, monospace',
  "--duration-fast": "150ms",
} as const;

export const statusColors = {
  light: {
    danger: "#b42318",
    success: "#067647",
  },
  dark: {
    danger: "#ff7a70",
    success: "#47cd89",
  },
} as const satisfies Record<
  ThemeName,
  { danger: string; success: string }
>;

const modeTokens = {
  light: {
    "--danger": statusColors.light.danger,
    "--success": statusColors.light.success,
    "--shadow-sm": "0 1px 2px rgb(15 23 42 / 0.06)",
    "--shadow-md": "0 16px 40px rgb(15 23 42 / 0.08)",
  },
  dark: {
    "--danger": statusColors.dark.danger,
    "--success": statusColors.dark.success,
    "--shadow-sm": "0 1px 2px rgb(0 0 0 / 0.24)",
    "--shadow-md": "0 16px 40px rgb(0 0 0 / 0.3)",
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

function createPalettes(): Record<PaletteId, PaletteDefinition> {
  const generated = {} as Record<PaletteId, PaletteDefinition>;

  for (const paletteId of Object.keys(paletteSources) as PaletteId[]) {
    const source = paletteSources[paletteId];
    generated[paletteId] = {
      label: source.label,
      description: source.description,
      swatches: paletteRoleOrder.map((role) => ({
        name: source.colors[role].name,
        value: source.colors[role].DEFAULT,
      })),
      modes: generateThemeModes(source),
    };
  }

  return generated;
}

export const palettes = createPalettes();

export const DEFAULT_PALETTE_ID: PaletteId = "padma";
export const paletteIds = Object.keys(palettes) as PaletteId[];

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === "string" && Object.hasOwn(palettes, value);
}

/**
 * Direct, typed primitives for component code. These references remain stable
 * while the active palette and light/dark values change at the document edge.
 */
export const theme = {
  colors: {
    background: "var(--background)",
    surface: "var(--surface)",
    cardSurface: "var(--card-surface)",
    surfaceRaised: "var(--surface-raised)",
    foreground: "var(--foreground)",
    muted: "var(--muted)",
    border: "var(--border)",
    primary: "var(--primary)",
    primaryHover: "var(--primary-hover)",
    primaryForeground: "var(--primary-foreground)",
    surfaceForeground: "var(--surface-foreground)",
    surfaceMuted: "var(--surface-muted)",
    surfacePrimary: "var(--surface-primary)",
    surfaceDanger: "var(--surface-danger)",
    surfaceSuccess: "var(--surface-success)",
    cardForeground: "var(--card-foreground)",
    cardMuted: "var(--card-muted)",
    cardPrimary: "var(--card-primary)",
    raisedForeground: "var(--raised-foreground)",
    raisedMuted: "var(--raised-muted)",
    raisedPrimary: "var(--raised-primary)",
    backgroundForeground: "var(--background-foreground)",
    backgroundMuted: "var(--background-muted)",
    backgroundPrimary: "var(--background-primary)",
    danger: "var(--danger)",
    success: "var(--success)",
    focus: "var(--focus)",
  },
  radii: {
    small: "var(--radius-sm)",
    medium: "var(--radius-md)",
    large: "var(--radius-lg)",
  },
  shadows: {
    small: "var(--shadow-sm)",
    medium: "var(--shadow-md)",
  },
  fonts: {
    sans: "var(--font-sans)",
    mono: "var(--font-mono)",
  },
  motion: {
    fast: "var(--duration-fast)",
  },
} as const;

function declarations(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
}

function semanticVariables(
  tokens: ThemeColorTokens,
  mode: ThemeName,
): Record<string, string> {
  const contrastInput = {
    ...tokens,
    ...statusColors[mode],
  };
  const backgroundContrast = guardSurfaceContrast({
    ...contrastInput,
    surface: tokens.background,
  });
  const surfaceContrast = guardSurfaceContrast(contrastInput);
  const cardContrast = guardSurfaceContrast({
    ...contrastInput,
    surface: tokens.cardSurface,
  });
  const raisedContrast = guardSurfaceContrast({
    ...contrastInput,
    surface: tokens.surfaceRaised,
  });

  return {
    "--background": tokens.background,
    "--surface": tokens.surface,
    "--card-surface": tokens.cardSurface,
    "--surface-raised": tokens.surfaceRaised,
    "--foreground": tokens.foreground,
    "--muted": tokens.muted,
    "--border": tokens.border,
    "--primary": tokens.primary,
    "--primary-hover": tokens.primaryHover,
    "--primary-foreground": tokens.primaryForeground,
    "--surface-foreground": surfaceContrast.foreground,
    "--surface-muted": surfaceContrast.muted,
    "--surface-primary": surfaceContrast.primary,
    "--surface-danger": surfaceContrast.danger,
    "--surface-success": surfaceContrast.success,
    "--card-foreground": cardContrast.foreground,
    "--card-muted": cardContrast.muted,
    "--card-primary": cardContrast.primary,
    "--card-danger": cardContrast.danger,
    "--card-success": cardContrast.success,
    "--raised-foreground": raisedContrast.foreground,
    "--raised-muted": raisedContrast.muted,
    "--raised-primary": raisedContrast.primary,
    "--raised-danger": raisedContrast.danger,
    "--raised-success": raisedContrast.success,
    "--background-foreground": backgroundContrast.foreground,
    "--background-muted": backgroundContrast.muted,
    "--background-primary": backgroundContrast.primary,
    "--background-danger": backgroundContrast.danger,
    "--background-success": backgroundContrast.success,
    "--focus": tokens.focus,
  };
}

function themeRule(
  selector: string,
  paletteId: PaletteId,
  mode: ThemeName,
): string {
  return `${selector}{color-scheme:${mode};${declarations(modeTokens[mode])};${declarations(semanticVariables(palettes[paletteId].modes[mode], mode))}}`;
}

function swatchRules(): string {
  return paletteIds
    .flatMap((paletteId) =>
      palettes[paletteId].swatches.map(
        (swatch, index) =>
          `[data-palette-preview="${paletteId}"]>[data-swatch="${index}"]{background:${swatch.value}}`,
      ),
    )
    .join("");
}

function contrastContextRule(
  context: "background" | "surface" | "card" | "raised",
): string {
  const selectors = [
    `[data-contrast-context="${context}"]`,
    `[data-contrast-hover-context="${context}"]:hover`,
  ].join(",");

  return `${selectors}{--context-foreground:var(--${context}-foreground);--context-muted:var(--${context}-muted);--context-primary:var(--${context}-primary);--context-danger:var(--${context}-danger);--context-success:var(--${context}-success);color:var(--context-foreground)}`;
}

export function createThemeCss(): string {
  const defaultLight = themeRule(":root", DEFAULT_PALETTE_ID, "light");
  const defaultDark = themeRule(
    '[data-theme="dark"]:not([data-palette])',
    DEFAULT_PALETTE_ID,
    "dark",
  );
  const systemDark = themeRule(
    ":root:not([data-theme])",
    DEFAULT_PALETTE_ID,
    "dark",
  );
  const paletteRules = paletteIds
    .flatMap((paletteId) =>
      (["light", "dark"] as const).map((mode) =>
        themeRule(
          `[data-palette="${paletteId}"][data-theme="${mode}"]`,
          paletteId,
          mode,
        ),
      ),
    )
    .join("");
  const contrastContextRules = [
    contrastContextRule("background"),
    contrastContextRule("surface"),
    contrastContextRule("card"),
    contrastContextRule("raised"),
    '[data-contrast-context].text-foreground,[data-contrast-context] .text-foreground{color:var(--context-foreground)}',
    '[data-contrast-context].text-muted,[data-contrast-context] .text-muted{color:var(--context-muted)}',
    '[data-contrast-context].text-primary,[data-contrast-context] .text-primary{color:var(--context-primary)}',
    '[data-contrast-context].text-danger,[data-contrast-context] .text-danger{color:var(--context-danger)}',
    '[data-contrast-context].text-success,[data-contrast-context] .text-success{color:var(--context-success)}',
  ].join("");

  return [
    `:root{${declarations(sharedTokens)}}`,
    defaultLight,
    defaultDark,
    `@media(prefers-color-scheme:dark){${systemDark}}`,
    paletteRules,
    contrastContextRules,
    swatchRules(),
  ].join("");
}

const bootstrapScript = `(() => {
  const paletteIds = ${JSON.stringify(paletteIds)};
  try {
    const savedTheme = localStorage.getItem("${THEME_STORAGE_KEY}");
    const savedPalette = localStorage.getItem("${PALETTE_STORAGE_KEY}");
    document.documentElement.dataset.theme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.palette =
      paletteIds.includes(savedPalette) ? savedPalette : "${DEFAULT_PALETTE_ID}";
  } catch {
    document.documentElement.dataset.theme =
      matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.palette = "${DEFAULT_PALETTE_ID}";
  }
})();`;

export function ThemeHead({ nonce }: { nonce: string }) {
  return (
    <>
      {/*
       * Browsers intentionally hide nonce content attributes after parsing.
       * React therefore reads an empty DOM attribute during hydration even
       * though the element's nonce property still contains the valid value.
       * Scope the escape hatch to these attributes; the CSS and script remain
       * deterministic and protected by the per-request CSP nonce.
       */}
      <style nonce={nonce} suppressHydrationWarning>
        {createThemeCss()}
      </style>
      <script
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: bootstrapScript }}
      />
    </>
  );
}

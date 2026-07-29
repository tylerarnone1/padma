import {
  contrastRatio,
  guardContrast,
  relativeLuminance,
  WCAG_AA_NORMAL_TEXT_RATIO,
} from "./contrast-guard";
import type { ColorScale, HexColor, PaletteSource } from "./palettes";

export type ThemeName = "light" | "dark";

export type ThemeColorTokens = {
  background: HexColor;
  surface: HexColor;
  cardSurface: HexColor;
  surfaceRaised: HexColor;
  foreground: HexColor;
  muted: HexColor;
  border: HexColor;
  primary: HexColor;
  primaryHover: HexColor;
  primaryForeground: HexColor;
  surfaceForegroundFallback: HexColor;
  focus: HexColor;
};

type AccentCandidate = {
  color: HexColor;
  hover: HexColor;
};

export const CARD_SURFACE_COLOR_WEIGHT = 0.76;
const CARD_SURFACE_WEIGHT_STEP = 0.08;

function mixHex(
  color: HexColor,
  canvas: HexColor,
  colorWeight: number,
): HexColor {
  const mixed = [1, 3, 5]
    .map((offset) => {
      const colorChannel = Number.parseInt(
        color.slice(offset, offset + 2),
        16,
      );
      const canvasChannel = Number.parseInt(
        canvas.slice(offset, offset + 2),
        16,
      );
      return Math.round(
        colorChannel * colorWeight + canvasChannel * (1 - colorWeight),
      )
        .toString(16)
        .padStart(2, "0");
    })
    .join("");

  return `#${mixed}`;
}

function createCardSurface(
  surface: HexColor,
  canvas: HexColor,
  textCandidates: readonly HexColor[],
): HexColor {
  for (
    let colorWeight = CARD_SURFACE_COLOR_WEIGHT;
    colorWeight > 0;
    colorWeight -= CARD_SURFACE_WEIGHT_STEP
  ) {
    const candidate = mixHex(surface, canvas, colorWeight);
    const hasReadableText = textCandidates.some(
      (text) =>
        contrastRatio(text, candidate) >= WCAG_AA_NORMAL_TEXT_RATIO,
    );

    if (hasReadableText) {
      return candidate;
    }
  }

  throw new Error(
    `Theme Generator could not derive an accessible muted card surface from ${surface} on ${canvas}`,
  );
}

function darkerColor(first: HexColor, second: HexColor): HexColor {
  return relativeLuminance(first) <= relativeLuminance(second) ? first : second;
}

function darkerScale(first: ColorScale, second: ColorScale): ColorScale {
  return relativeLuminance(first.DEFAULT) <= relativeLuminance(second.DEFAULT)
    ? first
    : second;
}

function rgbChroma(hex: HexColor): number {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  return Math.max(...channels) - Math.min(...channels);
}

function pickAccent(
  background: HexColor,
  candidates: readonly AccentCandidate[],
  textCandidates: readonly HexColor[],
): AccentCandidate {
  const viable = candidates.filter(
    (candidate) =>
      contrastRatio(candidate.color, background) >= 3 &&
      textCandidates.some(
        (text) => contrastRatio(text, candidate.color) >= 4.5,
      ),
  );

  if (viable.length === 0) {
    throw new Error(
      `Theme Generator could not find an accent with visible boundaries and readable text on ${background}`,
    );
  }

  return [...viable].sort((first, second) => {
    const chromaDifference = rgbChroma(second.color) - rgbChroma(first.color);
    if (Math.abs(chromaDifference) > 0.01) {
      return chromaDifference;
    }
    return (
      contrastRatio(second.color, background) -
      contrastRatio(first.color, background)
    );
  })[0]!;
}

function pickRaisedSurface(
  surface: HexColor,
  anchor: ColorScale,
  companion: ColorScale,
): HexColor {
  const surfaceLuminance = relativeLuminance(surface);
  const candidates = [companion[300], anchor[600]].filter(
    (candidate) => relativeLuminance(candidate) > surfaceLuminance,
  );

  if (candidates.length === 0) {
    return anchor[600];
  }

  return [...candidates].sort(
    (first, second) =>
      relativeLuminance(first) - relativeLuminance(second),
  )[0]!;
}

function generateLightTheme(source: PaletteSource): ThemeColorTokens {
  const { primaryDark, primaryLight, base, secondaryLight, secondaryDark } =
    source.colors;
  const foreground = darkerColor(
    primaryDark.DEFAULT,
    secondaryDark.DEFAULT,
  );
  const primaryTextCandidates = [
    base[900],
    foreground,
    secondaryDark.DEFAULT,
    base.DEFAULT,
  ] as const;
  const primary = pickAccent(
    base.DEFAULT,
    [
      { color: primaryDark[300], hover: primaryDark[200] },
      { color: primaryDark[400], hover: primaryDark[300] },
      { color: primaryDark.DEFAULT, hover: primaryDark[400] },
      { color: primaryLight.DEFAULT, hover: primaryLight[400] },
    ],
    primaryTextCandidates,
  );

  return {
    background: base.DEFAULT,
    surface: secondaryLight.DEFAULT,
    cardSurface: createCardSurface(
      secondaryLight.DEFAULT,
      base.DEFAULT,
      [foreground, ...primaryTextCandidates],
    ),
    surfaceRaised: base[600],
    foreground,
    muted: guardContrast(base.DEFAULT, primaryLight[400], [
      secondaryDark[400],
      foreground,
    ]) as HexColor,
    border: primaryLight[700],
    primary: primary.color,
    primaryHover: primary.hover,
    primaryForeground: guardContrast(
      primary.color,
      primaryTextCandidates[0],
      primaryTextCandidates.slice(1),
    ) as HexColor,
    surfaceForegroundFallback: base.DEFAULT,
    focus: secondaryDark.DEFAULT,
  };
}

function generateDarkTheme(source: PaletteSource): ThemeColorTokens {
  const { primaryDark, primaryLight, base, secondaryLight, secondaryDark } =
    source.colors;
  const anchor = darkerScale(primaryDark, secondaryDark);
  const companion =
    anchor === primaryDark ? primaryLight : secondaryLight;
  const background = anchor[400];
  const surface = anchor.DEFAULT;
  const primaryTextCandidates = [
    anchor[100],
    anchor[200],
    base.DEFAULT,
    base[900],
  ] as const;
  const primary = pickAccent(
    background,
    [
      { color: primaryDark[700], hover: primaryDark[800] },
      { color: primaryLight.DEFAULT, hover: primaryLight[600] },
      { color: secondaryLight.DEFAULT, hover: secondaryLight[600] },
    ],
    primaryTextCandidates,
  );

  return {
    background,
    surface,
    cardSurface: createCardSurface(
      surface,
      background,
      [base.DEFAULT, ...primaryTextCandidates],
    ),
    surfaceRaised: pickRaisedSurface(surface, anchor, companion),
    foreground: base.DEFAULT,
    muted: guardContrast(background, companion[900], [
      base[900],
      base.DEFAULT,
    ]) as HexColor,
    border: companion.DEFAULT,
    primary: primary.color,
    primaryHover: primary.hover,
    primaryForeground: guardContrast(
      primary.color,
      primaryTextCandidates[0],
      primaryTextCandidates.slice(1),
    ) as HexColor,
    surfaceForegroundFallback: base.DEFAULT,
    focus: primary.color,
  };
}

export function generateThemeModes(
  source: PaletteSource,
): Record<ThemeName, ThemeColorTokens> {
  return {
    light: generateLightTheme(source),
    dark: generateDarkTheme(source),
  };
}

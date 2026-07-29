export const WCAG_AA_NORMAL_TEXT_RATIO = 4.5;

type SurfaceContrastInput = {
  surface: string;
  foreground: string;
  muted: string;
  primary: string;
  primaryForeground: string;
  surfaceForegroundFallback: string;
  danger: string;
  success: string;
};

export type SurfaceContrastTokens = {
  foreground: string;
  muted: string;
  primary: string;
  danger: string;
  success: string;
};

export function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Contrast Guard expected a six-digit hex color: ${hex}`);
  }

  const linear = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

export function guardContrast(
  background: string,
  preferred: string,
  fallbacks: readonly string[],
): string {
  const candidates = [...new Set([preferred, ...fallbacks])];
  const accessible = candidates.find(
    (candidate) =>
      contrastRatio(candidate, background) >= WCAG_AA_NORMAL_TEXT_RATIO,
  );

  if (accessible) {
    return accessible;
  }

  const best = candidates
    .map((candidate) => ({
      candidate,
      ratio: contrastRatio(candidate, background),
    }))
    .sort((first, second) => second.ratio - first.ratio)[0]!;

  throw new Error(
    `Contrast Guard could not find accessible text for ${background}; best candidate ${best.candidate} is ${best.ratio.toFixed(2)}:1`,
  );
}

/**
 * Resolves semantic text used on a bold surface without changing that surface.
 * Candidate colors already belong to the active five-color palette mapping.
 */
export function guardSurfaceContrast(
  input: SurfaceContrastInput,
): SurfaceContrastTokens {
  const fallbacks = [
    input.foreground,
    input.primaryForeground,
    input.surfaceForegroundFallback,
  ] as const;

  return {
    foreground: guardContrast(
      input.surface,
      input.foreground,
      fallbacks,
    ),
    muted: guardContrast(input.surface, input.muted, fallbacks),
    primary: guardContrast(input.surface, input.primary, fallbacks),
    danger: guardContrast(input.surface, input.danger, fallbacks),
    success: guardContrast(input.surface, input.success, fallbacks),
  };
}

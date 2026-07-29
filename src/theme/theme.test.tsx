import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  contrastRatio,
  guardSurfaceContrast,
  relativeLuminance,
} from "./contrast-guard";
import { paletteRoleOrder, paletteSources } from "./palettes";
import {
  createThemeCss,
  DEFAULT_PALETTE_ID,
  isPaletteId,
  palettes,
  paletteIds,
  statusColors,
  theme,
  ThemeHead,
} from "./theme";

function squaredRgbDistance(first: string, second: string): number {
  return [1, 3, 5].reduce((distance, offset) => {
    const difference =
      Number.parseInt(first.slice(offset, offset + 2), 16) -
      Number.parseInt(second.slice(offset, offset + 2), 16);
    return distance + difference ** 2;
  }, 0);
}

describe("theme contract", () => {
  it("standardizes every source into the same two luminance ramps", () => {
    for (const source of Object.values(paletteSources)) {
      expect(Object.keys(source.colors)).toEqual(paletteRoleOrder);

      const { primaryDark, primaryLight, base, secondaryLight, secondaryDark } =
        source.colors;

      expect(relativeLuminance(primaryDark.DEFAULT)).toBeLessThan(
        relativeLuminance(primaryLight.DEFAULT),
      );
      expect(relativeLuminance(primaryLight.DEFAULT)).toBeLessThan(
        relativeLuminance(base.DEFAULT),
      );
      expect(relativeLuminance(secondaryDark.DEFAULT)).toBeLessThan(
        relativeLuminance(secondaryLight.DEFAULT),
      );
      expect(relativeLuminance(secondaryLight.DEFAULT)).toBeLessThan(
        relativeLuminance(base.DEFAULT),
      );
      expect(primaryDark[500]).toBe(primaryDark.DEFAULT);
      expect(primaryLight[500]).toBe(primaryLight.DEFAULT);
      expect(base[500]).toBe(base.DEFAULT);
      expect(secondaryLight[500]).toBe(secondaryLight.DEFAULT);
      expect(secondaryDark[500]).toBe(secondaryDark.DEFAULT);
    }
  });

  it("defines matching semantic tokens for every palette mode", () => {
    for (const palette of Object.values(palettes)) {
      expect(Object.keys(palette.modes.light).sort()).toEqual(
        Object.keys(palette.modes.dark).sort(),
      );
    }
  });

  it("emits every palette, both modes, and every preview swatch", () => {
    const css = createThemeCss();

    for (const paletteId of paletteIds) {
      expect(css).toContain(
        `[data-palette="${paletteId}"][data-theme="light"]`,
      );
      expect(css).toContain(
        `[data-palette="${paletteId}"][data-theme="dark"]`,
      );
      expect(css).toContain(`[data-palette-preview="${paletteId}"]`);
    }
    expect(css).toContain("prefers-color-scheme:dark");
  });

  it("validates persisted palette identifiers", () => {
    expect(isPaletteId(DEFAULT_PALETTE_ID)).toBe(true);
    expect(isPaletteId("not-a-palette")).toBe(false);
    expect(isPaletteId("__proto__")).toBe(false);
    expect(isPaletteId(null)).toBe(false);
  });

  it("anchors Olive & Earth to its defining canvas colors", () => {
    expect(palettes["olive-earth"].modes.light.background).toBe("#fefae0");
    expect(palettes["olive-earth"].modes.light.surface).toBe("#dda15e");
    expect(palettes["olive-earth"].modes.dark.background).toBe("#1f2a13");
    expect(palettes["olive-earth"].modes.dark.surface).toBe("#283618");
  });

  it("mutes cards toward the canvas without changing the palette surface", () => {
    for (const [paletteId, palette] of Object.entries(palettes)) {
      for (const [mode, colors] of Object.entries(palette.modes)) {
        expect(
          colors.cardSurface,
          `${paletteId} ${mode} card surface`,
        ).not.toBe(colors.surface);
        expect(
          squaredRgbDistance(colors.cardSurface, colors.background),
          `${paletteId} ${mode} card distance from canvas`,
        ).toBeLessThan(
          squaredRgbDistance(colors.surface, colors.background),
        );
      }
    }
  });

  it("keeps body, muted, and primary button text WCAG AA readable", () => {
    for (const [paletteId, palette] of Object.entries(palettes)) {
      for (const [mode, colors] of Object.entries(palette.modes)) {
        const contrastInput = {
          ...colors,
          ...statusColors[mode as keyof typeof statusColors],
        };

        expect(
          contrastRatio(colors.foreground, colors.background),
          `${paletteId} ${mode} foreground`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(colors.muted, colors.background),
          `${paletteId} ${mode} muted`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(colors.primaryForeground, colors.primary),
          `${paletteId} ${mode} primary`,
        ).toBeGreaterThanOrEqual(4.5);

        for (const [context, contextColor] of Object.entries({
          background: colors.background,
          surface: colors.surface,
          card: colors.cardSurface,
          raised: colors.surfaceRaised,
        })) {
          const guarded = guardSurfaceContrast({
            ...contrastInput,
            surface: contextColor,
          });

          for (const [role, textColor] of Object.entries(guarded)) {
            expect(
              contrastRatio(textColor, contextColor),
              `${paletteId} ${mode} ${role} on ${context}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });

  it("exposes stable typed variable references to components", () => {
    expect(theme.colors.background).toBe("var(--background)");
    expect(theme.colors.cardSurface).toBe("var(--card-surface)");
    expect(theme.colors.cardMuted).toBe("var(--card-muted)");
    expect(theme.colors.surfaceMuted).toBe("var(--surface-muted)");
    expect(theme.colors.surfaceSuccess).toBe("var(--surface-success)");
    expect(theme.colors.raisedMuted).toBe("var(--raised-muted)");
    expect(theme.colors.backgroundForeground).toBe(
      "var(--background-foreground)",
    );
    expect(theme.radii.large).toBe("var(--radius-lg)");
  });

  it("keeps Rustic Charm raised typography readable inside dark cards", () => {
    const colors = palettes["rustic-charm"].modes.light;
    const raised = guardSurfaceContrast({
      ...colors,
      ...statusColors.light,
      surface: colors.surfaceRaised,
    });

    expect(contrastRatio(raised.muted, colors.surfaceRaised)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("keeps the request nonce on the generated theme tags", () => {
    const markup = renderToStaticMarkup(<ThemeHead nonce="request-nonce" />);

    expect(markup.match(/nonce="request-nonce"/g)).toHaveLength(2);
    expect(markup).toContain("padma-color-palette");
  });
});

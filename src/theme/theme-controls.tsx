"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_PALETTE_ID,
  isPaletteId,
  palettes,
  paletteIds,
  PALETTE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type PaletteId,
  type ThemeName,
} from "./theme";

const themeChangeEvent = "padma:theme-change";
type ThemeSnapshot = `${PaletteId}:${ThemeName}`;

function getStoredValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in hardened browsing modes. The active page
    // still changes; only persistence across visits is lost.
  }
}

function activeMode(): ThemeName {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function activePalette(): PaletteId {
  const value = document.documentElement.dataset.palette;
  return isPaletteId(value) ? value : DEFAULT_PALETTE_ID;
}

function snapshot(): ThemeSnapshot {
  return `${activePalette()}:${activeMode()}`;
}

function serverSnapshot(): ThemeSnapshot {
  return `${DEFAULT_PALETTE_ID}:light`;
}

function notifyThemeChange(): void {
  window.dispatchEvent(new Event(themeChangeEvent));
}

function applyPalette(paletteId: PaletteId): void {
  setStoredValue(PALETTE_STORAGE_KEY, paletteId);
  document.documentElement.dataset.palette = paletteId;
  notifyThemeChange();
}

function applyMode(mode: ThemeName): void {
  setStoredValue(THEME_STORAGE_KEY, mode);
  document.documentElement.dataset.theme = mode;
  notifyThemeChange();
}

function subscribe(onStoreChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemChange = () => {
    if (getStoredValue(THEME_STORAGE_KEY) === null) {
      document.documentElement.dataset.theme = media.matches ? "dark" : "light";
      onStoreChange();
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key !== THEME_STORAGE_KEY &&
      event.key !== PALETTE_STORAGE_KEY
    ) {
      return;
    }

    const savedTheme = getStoredValue(THEME_STORAGE_KEY);
    const savedPalette = getStoredValue(PALETTE_STORAGE_KEY);
    document.documentElement.dataset.theme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : media.matches
          ? "dark"
          : "light";
    document.documentElement.dataset.palette = isPaletteId(savedPalette)
      ? savedPalette
      : DEFAULT_PALETTE_ID;
    onStoreChange();
  };

  window.addEventListener(themeChangeEvent, onStoreChange);
  window.addEventListener("storage", handleStorage);
  media.addEventListener("change", handleSystemChange);

  return () => {
    window.removeEventListener(themeChangeEvent, onStoreChange);
    window.removeEventListener("storage", handleStorage);
    media.removeEventListener("change", handleSystemChange);
  };
}

export function ThemeControls() {
  const current = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [paletteId, mode] = current.split(":") as [PaletteId, ThemeName];
  const nextMode = mode === "dark" ? "light" : "dark";

  function selectPalette(nextPalette: PaletteId) {
    applyPalette(nextPalette);
  }

  function toggleMode() {
    applyMode(nextMode);
  }

  return (
    <details className="group fixed right-4 bottom-4 z-50">
      <summary
        data-contrast-context="surface"
        data-contrast-hover-context="raised"
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-[var(--shadow-md)] hover:bg-surface-raised"
      >
        <PaletteIcon />
        <span>{palettes[paletteId].label}</span>
        <span aria-hidden="true" className="text-muted">
          ·
        </span>
        <span className="capitalize text-muted">{mode}</span>
      </summary>

      <div
        data-contrast-context="card"
        className="absolute right-0 bottom-14 w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius-lg)] border border-border bg-card-surface p-3 shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center justify-between gap-4 px-2 pt-1 pb-3">
          <div>
            <p className="text-sm font-semibold">Preview a palette</p>
            <p className="mt-0.5 text-xs text-muted">
              Pick a foundation, then make it yours.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleMode}
            data-contrast-context="background"
            data-contrast-hover-context="raised"
            className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold hover:bg-surface-raised"
            aria-label={`Switch to ${nextMode} mode`}
          >
            <ModeIcon mode={mode} />
            <span className="capitalize">{mode}</span>
          </button>
        </div>

        <div className="grid gap-1" aria-label="Color palettes">
          {paletteIds.map((optionId) => {
            const palette = palettes[optionId];
            const selected = optionId === paletteId;

            return (
              <button
                key={optionId}
                type="button"
                onClick={() => selectPalette(optionId)}
                aria-pressed={selected}
                data-contrast-context={selected ? "raised" : "card"}
                data-contrast-hover-context="raised"
                className={`grid grid-cols-[1fr_auto] items-center gap-4 rounded-[var(--radius-md)] px-3 py-2.5 text-left hover:bg-surface-raised ${
                  selected ? "bg-surface-raised" : ""
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold">
                    {palette.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">
                    {palette.description}
                  </span>
                </span>
                <span
                  data-palette-preview={optionId}
                  className="flex overflow-hidden rounded-full border border-border"
                  aria-hidden="true"
                >
                  {palette.swatches.map((swatch, index) => (
                    <span
                      key={swatch.name}
                      data-swatch={index}
                      className="size-4 first:w-5 last:w-5"
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function PaletteIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 1.2-3.15 1.8 1.8 0 0 1 1.2-3.15H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z" />
      <circle cx="7.5" cy="11.5" r=".75" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7.5" r=".75" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r=".75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ModeIcon({ mode }: { mode: ThemeName }) {
  return mode === "dark" ? (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M20.4 14.7A8 8 0 0 1 9.3 3.6 8.5 8.5 0 1 0 20.4 14.7Z" />
    </svg>
  );
}

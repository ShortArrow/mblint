import { readPref, removePref, writePref } from "./prefs";

export type Theme = "light" | "dark";

/** A theme the user chooses: one of the two, or whichever the system prefers. */
export type ThemeChoice = Theme | "system";

const STORAGE_KEY = "mblint-theme";

/** The stored theme if valid, otherwise the system's. */
export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

/** The choice that `stored` records: light or dark when stored, the system's theme otherwise. */
export function themeChoice(stored: string | null): ThemeChoice {
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** Radius of a circle centred at (x, y) that covers the whole w × h area. */
export function coverRadius(x: number, y: number, w: number, h: number): number {
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

/** The theme stored in the browser, or `null` when none is or storage is unavailable. */
export function storedTheme(): string | null {
  return readPref(STORAGE_KEY);
}

/** Stores `choice` and applies the theme it resolves to; the document changes even when storage fails. */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === "system") removePref(STORAGE_KEY);
  else writePref(STORAGE_KEY, choice);
  document.documentElement.dataset.theme = resolveTheme(choice === "system" ? null : choice, prefersDark());
}

/** Whether the system prefers a dark theme. */
export function prefersDark(): boolean {
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

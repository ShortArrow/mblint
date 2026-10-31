export type Theme = "light" | "dark";

const STORAGE_KEY = "mblint-theme";

/** The stored theme if valid, otherwise the system's. */
export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

export function toggleTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

/** Radius of a circle centred at (x, y) that covers the whole w × h area. */
export function coverRadius(x: number, y: number, w: number, h: number): number {
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

/** The theme stored in the browser, or `null` when none is or storage is unavailable. */
export function storedTheme(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Applies `theme` to the document and stores it; the document changes even when storage fails. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    return;
  }
}

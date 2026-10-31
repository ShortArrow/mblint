/** The value stored in the browser under `key`, or `null` when none is or storage is unavailable. */
export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Stores `value` under `key`, doing nothing when storage is unavailable. */
export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

/** The flag stored as `stored` by `flagValue`, or `fallback` when nothing valid is stored. */
export function flag(stored: string | null, fallback: boolean): boolean {
  if (stored === "on") return true;
  if (stored === "off") return false;
  return fallback;
}

/** The stored form of a flag, read back by `flag`. */
export function flagValue(on: boolean): string {
  return on ? "on" : "off";
}

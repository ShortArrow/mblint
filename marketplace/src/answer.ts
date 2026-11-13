import type { Found } from "./listing";

/** An hour, in milliseconds: how long a kept answer is served before GitHub is asked again. */
export const HOUR = 60 * 60 * 1000;

/** GitHub's answer as kept, with `at`, the time it was taken in milliseconds since the epoch. */
export type Kept = { at: number; found: Found[] };

/** Where GitHub's last answer is kept; `get` fails when the store cannot be read. */
export type Store = { get(): Promise<Kept | null>; keep(kept: Kept): Promise<void> };

/** What the marketplace serves: an answer taken at `at`, or why it has none. */
export type Answer = { kind: "answer"; at: number; found: Found[] } | { kind: "busy" } | { kind: "unreachable" };

/**
 * The answer to serve at `now`: the one kept in `store` while it is younger than an hour, otherwise
 * GitHub's from `search`, kept for the next visitor; the kept one when GitHub cannot be reached; and
 * busy, without asking GitHub, when `store` cannot be read.
 */
export async function currentAnswer(now: number, store: Store, search: () => Promise<Found[]>): Promise<Answer> {
  let kept: Kept | null;
  try {
    kept = await store.get();
  } catch {
    return { kind: "busy" };
  }
  if (kept !== null && now - kept.at < HOUR) return { kind: "answer", ...kept };
  let found: Found[];
  try {
    found = await search();
  } catch {
    return kept === null ? { kind: "unreachable" } : { kind: "answer", ...kept };
  }
  await store.keep({ at: now, found }).catch(() => {});
  return { kind: "answer", at: now, found };
}

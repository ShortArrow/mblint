import { MAX_EDIT_BYTES } from "./editor";
import type { Files } from "./mblint";

/** A folder of a GitHub repository at a branch, tag or commit; `ref` is null for the default branch. */
export type Address = { owner: string; repo: string; ref: string | null; path: string };

/** The most TOML files a folder may hold to be loaded. */
export const MAX_ROOT_FILES = 200;

type Fetch = (url: string) => Promise<Response>;
type Entry = { path: string; type: string; size?: number };

const NAME = "[A-Za-z0-9_.-]+";
const ADDRESS = new RegExp(`^https://github\\.com/(${NAME})/(${NAME})(?:/tree/([^/]+)((?:/[^/]+)*))?/?$`);

/**
 * The folder `https://github.com/<owner>/<repo>` names, the root of its default branch, or
 * `https://github.com/<owner>/<repo>/tree/<ref>/<path>` names; `null` for any other text.
 */
export function parseAddress(text: string): Address | null {
  const found = ADDRESS.exec(text.trim());
  if (!found) return null;
  const [, owner, repo, ref, path] = found;
  const segments = [owner!, repo!, ...(ref ? [ref] : []), ...(path ?? "").split("/").filter(Boolean)];
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  return { owner: owner!, repo: repo!.replace(/\.git$/, ""), ref: ref ?? null, path: (path ?? "").replace(/^\//, "") };
}

/** The prefix `github/<owner>/<repo>/` of a path loaded from a repository, or `""` for any other path. */
export function rootOf(path: string): string {
  return /^github\/[^/]+\/[^/]+\//.exec(path)?.[0] ?? "";
}

/** Why GitHub's answer `response` gives nothing, or null when it is an answer. */
function refusal(response: Response): string | null {
  if (response.ok) return null;
  if (response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0") {
    return "GitHub refused, as the page asked it too often; try again later.";
  }
  if (response.status === 404) return "The address names no public repository.";
  return `GitHub answered ${response.status}.`;
}

/**
 * The TOML files in the folder `at` and below, keyed `github/<owner>/<repo>/` followed by the
 * path from the folder, with the paths in the repository of those longer than 1 MiB, which are
 * left out; or why none is taken.
 */
export async function fetchRoot(at: Address, fetch: Fetch): Promise<{ files: Files; tooLong: string[] } | { refused: string }> {
  const api = `https://api.github.com/repos/${at.owner}/${at.repo}`;
  let ref = at.ref;
  if (ref === null) {
    const repository = await fetch(api);
    const refused = refusal(repository);
    if (refused) return { refused };
    ref = ((await repository.json()) as { default_branch: string }).default_branch;
  }
  const listing = await fetch(`${api}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  const refused = refusal(listing);
  if (refused) return { refused };
  const { tree, truncated } = (await listing.json()) as { tree: Entry[]; truncated: boolean };
  const folder = at.path === "" ? "" : `${at.path}/`;
  const tomls = tree.filter((entry) => entry.type === "blob" && entry.path.startsWith(folder) && entry.path.endsWith(".toml"));
  if (truncated || tomls.length > MAX_ROOT_FILES) return { refused: `The folder holds more than ${MAX_ROOT_FILES} TOML files.` };
  if (tomls.length === 0) return { refused: "The folder holds no TOML file." };
  const tooLong = tomls.filter((entry) => (entry.size ?? 0) > MAX_EDIT_BYTES).map((entry) => entry.path);
  const taken = tomls.filter((entry) => (entry.size ?? 0) <= MAX_EDIT_BYTES);
  const raw = `https://raw.githubusercontent.com/${at.owner}/${at.repo}/${encodeURIComponent(ref)}`;
  const answers = await Promise.all(taken.map((entry) => fetch(`${raw}/${entry.path.split("/").map(encodeURIComponent).join("/")}`)));
  const failed = answers.map(refusal).find(Boolean);
  if (failed) return { refused: failed };
  const texts = await Promise.all(answers.map((answer) => answer.text()));
  const files = Object.fromEntries(
    taken.map((entry, i) => [`github/${at.owner}/${at.repo}/${entry.path.slice(folder.length)}`, texts[i]!]),
  );
  return { files, tooLong };
}

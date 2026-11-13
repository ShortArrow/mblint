/** A repository as GitHub's search API returns it, with the fields the listing reads. */
export type Found = {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  pushed_at: string;
  html_url: string;
};

/** A repository as the marketplace shows it; `open` is the simulator's address that loads it. */
export type Listing = {
  name: string;
  description: string;
  stars: number;
  pushedAt: string;
  repository: string;
  open: string;
};

const SIMULATOR = "https://mblint.shortarrow.jp/";

/**
 * The repositories in `found` that `excluded` does not name, compared ignoring case, as the
 * marketplace shows them, most stars first.
 */
export function listRepositories(found: Found[], excluded: string[]): Listing[] {
  const left = new Set(excluded.map((name) => name.toLowerCase()));
  return found
    .filter((repository) => !left.has(repository.full_name.toLowerCase()))
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .map((repository) => ({
      name: repository.full_name,
      description: repository.description ?? "",
      stars: repository.stargazers_count,
      pushedAt: repository.pushed_at,
      repository: repository.html_url,
      open: `${SIMULATOR}?github=${repository.full_name}`,
    }));
}

/** The entries of `listed` whose name or description contains `text`, ignoring case. */
export function narrow(listed: Listing[], text: string): Listing[] {
  const wanted = text.toLowerCase();
  return listed.filter((entry) => `${entry.name}\n${entry.description}`.toLowerCase().includes(wanted));
}

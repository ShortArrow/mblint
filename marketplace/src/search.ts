import type { Found } from "./listing";

/** How many repositories GitHub's search API returns per page, and the most pages it serves. */
const PER_PAGE = 100;
const MAX_PAGES = 10;

/**
 * The public repositories carrying the topic `mblint-rig`, asked of GitHub's search API with
 * `token` through `fetch`, page after page until one is not full; fails when GitHub refuses.
 */
export async function searchTopic(token: string, fetch: (request: Request) => Promise<Response>): Promise<Found[]> {
  const found: Found[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const query = new URLSearchParams({ q: "topic:mblint-rig is:public", per_page: `${PER_PAGE}`, page: `${page}` });
    const response = await fetch(
      new Request(`https://api.github.com/search/repositories?${query}`, {
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "mblint-marketplace" },
      }),
    );
    if (!response.ok) throw new Error(`GitHub answered ${response.status}.`);
    const { items } = (await response.json()) as { items: Found[] };
    found.push(
      ...items.map(({ full_name, description, stargazers_count, pushed_at, html_url }) => ({
        full_name,
        description,
        stargazers_count,
        pushed_at,
        html_url,
      })),
    );
    if (items.length < PER_PAGE) break;
  }
  return found;
}

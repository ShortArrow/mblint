import { type Kept, type Store, currentAnswer } from "./answer";
import { EXCLUDED } from "./excluded";
import { renderPage } from "./page";
import { searchTopic } from "./search";

/** The marketplace's bindings: the KV namespace that keeps GitHub's answer, and the token for GitHub. */
export type Env = {
  LISTING: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> };
  GITHUB_TOKEN: string;
};

const KEY = "answer";

/** The store of GitHub's answer under `KEY` in `kv`. */
function storeIn(kv: Env["LISTING"]): Store {
  return {
    get: async () => {
      const text = await kv.get(KEY);
      return text === null ? null : (JSON.parse(text) as Kept);
    },
    keep: (kept) => kv.put(KEY, JSON.stringify(kept)),
  };
}

/**
 * The answer to `request` at `now`: the marketplace's page at `/`, narrowed by the address's `q`,
 * asking GitHub through `fetch` when the kept answer is due; 503 when busy, 404 for any other path.
 */
export async function handle(
  request: Request,
  env: Env,
  now: number,
  fetch: (request: Request) => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== "/") return new Response("Not found", { status: 404 });
  const answer = await currentAnswer(now, storeIn(env.LISTING), () => searchTopic(env.GITHUB_TOKEN, fetch));
  const status = answer.kind === "answer" ? 200 : 503;
  return new Response(renderPage(answer, EXCLUDED, url.searchParams.get("q") ?? "", now), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env, Date.now(), (outgoing) => fetch(outgoing)),
};

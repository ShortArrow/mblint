import { type Answer, HOUR } from "./answer";
import { type Listing, listRepositories, narrow } from "./listing";

/** `text` with the characters HTML gives meaning to replaced by their references. */
function escape(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** The page around `body`, with the narrowing field holding `text`. */
function frame(body: string, text: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mblint marketplace</title>
</head>
<body>
<h1>mblint marketplace</h1>
<p>Rigs published on GitHub with the topic <code>mblint-rig</code>.</p>
<form method="get"><input name="q" type="search" value="${escape(text)}" aria-label="Narrow"><button>Narrow</button></form>
${body}
</body>
</html>
`;
}

/** One repository as a list item. */
function item(entry: Listing): string {
  return `<li><a href="${escape(entry.repository)}">${escape(entry.name)}</a> <span>★ ${entry.stars}</span> <span>${escape(entry.pushedAt.slice(0, 10))}</span>
<p>${escape(entry.description)}</p>
<a href="${escape(entry.open)}">Open in the simulator</a></li>`;
}

/** How long before `now` the answer taken at `at` was, when it is an hour or more. */
function age(at: number, now: number): string {
  const hours = Math.floor((now - at) / HOUR);
  return hours < 1 ? "" : `<p>This list was taken from GitHub ${hours} ${hours === 1 ? "hour" : "hours"} ago.</p>`;
}

/**
 * The marketplace's page for `answer` at `now`: the repositories it found that `excluded` does
 * not name, narrowed by `text`, or why there are none.
 */
export function renderPage(answer: Answer, excluded: string[], text: string, now: number): string {
  if (answer.kind === "busy") return frame("<p>The marketplace is busy; try again later.</p>", text);
  if (answer.kind === "unreachable") return frame("<p>GitHub cannot be reached; try again later.</p>", text);
  const listed = narrow(listRepositories(answer.found, excluded), text);
  return frame(`${age(answer.at, now)}<ul>\n${listed.map(item).join("\n")}\n</ul>`, text);
}

import { type Answer, HOUR } from "./answer";
import { type Listing, SIMULATOR, listRepositories, narrow } from "./listing";

/** `text` with the characters HTML gives meaning to replaced by their references. */
function escape(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

const STYLE = `:root {
  color-scheme: light dark;
  --bg: light-dark(#f4f5f7, #0d1014);
  --panel: light-dark(#ffffff, #151a21);
  --panel-2: light-dark(#f9fafb, #1b212a);
  --line: light-dark(#d9dde3, #2a323d);
  --ink: light-dark(#14171c, #e8ecf1);
  --muted: light-dark(#667085, #8b95a3);
  --accent: light-dark(#2f6bff, #6e9bff);
  --shadow-tint: light-dark(rgba(16, 24, 40, 0.07), transparent);
  --shadow: 0 1px 2px var(--shadow-tint), 0 1px 3px var(--shadow-tint);
}
* { box-sizing: border-box; }
html { overflow-x: hidden; }
body { margin: 0; background: var(--panel); color: var(--ink); font: 14px/20px Inter, system-ui, sans-serif; }
code { font-family: "JetBrains Mono", ui-monospace, monospace; }
a { color: var(--accent); }
header { display: flex; align-items: center; height: 56px; padding: 0 24px; background: var(--panel); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5; }
header h1 { font-size: 17px; margin: 0; letter-spacing: -0.01em; }
header h1 span { color: var(--muted); font-weight: 500; }
header .button { margin-left: auto; }
#publish { margin-top: 32px; max-width: 640px; }
#publish h2 { font-size: 15px; margin: 0 0 8px; }
#publish ol { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
main { padding: 24px; background: var(--bg); min-height: calc(100vh - 56px); }
main > p { color: var(--muted); margin: 0 0 16px; }
form { display: flex; gap: 8px; margin: 0 0 20px; max-width: 480px; }
input, button, .button { font: inherit; color: inherit; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; }
input { flex: 1; min-width: 0; }
button, .button { cursor: pointer; text-decoration: none; }
.repositories { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 16px; }
.repositories > li { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); overflow-wrap: anywhere; }
.repositories > li > a:first-child { font-weight: 600; font-size: 15px; color: var(--ink); text-decoration: none; }
.repositories > li > a:first-child:hover { color: var(--accent); }
.repositories > li > span { color: var(--muted); font-size: 12px; }
.repositories > li > p { margin: 0; flex: 1; }
.repositories > li > .button { align-self: flex-start; }
@media (max-width: 640px) { header { padding: 0 16px; } main { padding: 16px; } }`;

/** The steps for publishing a rig, as the marketplace lists them. */
const PUBLISH = `<section id="publish">
<h2>Publish your rig</h2>
<ol>
<li>Make a public repository on GitHub, for example from the template <a href="https://github.com/ShortArrow/mblint-rigs">ShortArrow/mblint-rigs</a>.</li>
<li>Put the files of a rig exported from the simulator at the root of its default branch.</li>
<li>Add the topic <code>mblint-rig</code> to the repository.</li>
<li>Wait up to an hour for the marketplace to list it.</li>
</ol>
</section>`;

/** The page around `body`, with the narrowing field holding `text`. */
function frame(body: string, text: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mblint marketplace</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=optional">
<style>
${STYLE}
</style>
</head>
<body>
<header><h1>mblint <span>marketplace</span></h1><a class="button" href="${SIMULATOR}">Simulator</a></header>
<main>
<p>Rigs published on GitHub with the topic <code>mblint-rig</code>.</p>
<form method="get"><input name="q" type="search" value="${escape(text)}" aria-label="Narrow"><button>Narrow</button></form>
${body}
${PUBLISH}
</main>
</body>
</html>
`;
}

/** One repository as a list item. */
function item(entry: Listing): string {
  return `<li><a href="${escape(entry.repository)}">${escape(entry.name)}</a> <span>★ ${entry.stars}</span> <span>${escape(entry.pushedAt.slice(0, 10))}</span>
<p>${escape(entry.description)}</p>
<a class="button" href="${escape(entry.open)}">Open in the simulator</a></li>`;
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
  return frame(`${age(answer.at, now)}<ul class="repositories">\n${listed.map(item).join("\n")}\n</ul>`, text);
}

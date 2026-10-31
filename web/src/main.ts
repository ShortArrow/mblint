import init from "./wasm/mblint_wasm";
import { boardPaths, dataFiles } from "./files";
import { lint } from "./mblint";
import { lintLines } from "./view";

const root = "../../data/";
const files = dataFiles(
  import.meta.glob<string>("../../data/**/*.toml", { query: "?raw", import: "default", eager: true }),
  root,
);

const select = document.querySelector<HTMLSelectElement>("#board")!;
const output = document.querySelector<HTMLPreElement>("#report")!;

function show(board: string): void {
  output.textContent = lintLines(lint(files, board)).join("\n");
}

await init();
for (const board of boardPaths(files)) {
  select.add(new Option(board, board));
}
select.addEventListener("change", () => show(select.value));
show(select.value);

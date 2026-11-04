# Web simulator

[日本語](web.jp.md)

The web simulator runs the core in the browser as Wasm. The page is TypeScript under `web/`; the Wasm module is the crate `mblint-wasm`.

## Wasm interface

The module exports these functions. Each but `rebind` takes the files it may read as an object mapping a path, by the rule for paths in [the data schema](schema.md), to the file's contents.

| Function | Arguments | Returns |
| --- | --- | --- |
| `check(files, rig)` | `files`, and `rig`, the path of the rig file | The report of `mblint check --json` in [the command line](cli.md) |
| `lint(files, board)` | `files`, and `board`, the path of the board file | The report of `mblint lint --json` |
| `catalog(files)` | `files` | What each file is, as in [Catalog](#catalog) |
| `layout(files, rig)` | `files`, and `rig`, the path of the rig file | The rig's board as the page draws it, as in [Layout](#layout) |
| `rebind(text, board, bindings)` | `text`, a rig file; `board`, a path; and `bindings`, an object mapping each socket path to a device path | `text` with `board` and `bindings` in place of the rig's, as in [Rebinding](#rebinding) |

Files are read only by the paths the rig or the call names, as the CLI reads them under its data root. A path absent from `files` cannot be read.

When a file cannot be loaded, the function throws an `Error` whose message names the file and why, the message the CLI prints to standard error after `mblint: `. No report is returned.

### Rebinding

`rebind` changes only the values that differ and keeps the rest of `text` as it is, its comments, order and layout included. A binding whose socket is in `bindings` keeps its place and takes the new path; one whose socket is not is removed with the comment at the end of its line, while the comments on the lines above it stay, above the next binding or at the end of the bindings; a socket new to the rig is added after the last binding. The bindings keep the form the text gives them, a table or an inline table, and a rig without bindings gains a `[bindings]` table at the end. When `text` is not a rig, `rebind` throws as the other functions do.

## Catalog

`catalog(files)` returns an object keyed by every path in `files`, saying what the file there is. A file's kind is decided by its contents, not its path: it is a board if it parses as a board, a device if it parses as a device, and a rig if it parses as a rig. The required fields of the three do not overlap, so at most one applies.

```json
{
  "boards/asus/proart_x870e_creator_wifi.toml": {
    "kind": "board", "vendor": "ASUS", "model": "ProArt X870E-CREATOR WIFI"
  },
  "devices/rtx_a400.toml": {
    "kind": "device", "name": "NVIDIA RTX A400 4GB", "type": "card",
    "interface": { "protocol": "pcie", "generation": 4, "lanes": 8 },
    "socket_category": "pcie_slot"
  },
  "rigs/workstation.toml": {
    "kind": "rig", "name": "workstation", "board": "boards/asus/proart_x870e_creator_wifi.toml",
    "bindings": { "PCIEX16(G5)_1": "devices/rtx_a400.toml" }
  },
  "notes.toml": { "kind": "invalid", "message": "not a board: …; not a device: …; not a rig: …" }
}
```

| `kind` | Fields |
| --- | --- |
| `board` | `vendor` and `model` of the board |
| `device` | `name` and `type` of the device; `interface`, the device's own link, or `null` for an adapter or a display; `socket_category`, the category of the board socket it is installed in |
| `rig` | `name` of the rig, `board`, the path of its board, and `bindings`, the device path installed in each socket path |
| `invalid` | `message`, which says why the file is not a board, why not a device and why not a rig |

`socket_category` is `pcie_slot` for a card, `m2_slot` for an M.2 module, `usb_c` for a display, and `usb_c` or `usb_a` for an adapter, after its upstream connector.

## Layout

`layout(files, rig)` returns every node of the rig's board, keyed by node id, with what the devices the rig installs make of it. It is computed from the rig alone, whether or not a pass reports an error, so that a rig with errors can still be drawn.

```json
{
  "root_cpu": { "kind": "root", "parent": null, "generation": 5, "supplied": 20, "demanded": 16 },
  "mux_cpu_x16": { "kind": "mux", "parent": "root_cpu", "mode": 1 },
  "PCIEX16(G5)_1": {
    "kind": "socket", "parent": "mux_cpu_x16", "category": "pcie_slot", "slot_index": 2,
    "device": "devices/rtx_a400.toml", "disabled": false,
    "offers": { "generation": 5, "lanes": 8 }, "needs": { "generation": 4, "lanes": 8 }
  }
}
```

| `kind` | Fields besides `parent` |
| --- | --- |
| `root` | `generation`; `supplied`, the lanes it supplies; `demanded`, the lanes its children demand, counted as Pass 2 counts them |
| `mux` | `mode`, the position from 0 of the selected mode in the order the modes are declared, or `null` when no mode holds |
| `bridge` | `lanes`, the upstream lanes it demands of its parent |
| `controller` | none |
| `socket` | `category`; `slot_index`, or `null` for a socket other than a PCIe slot; `device`, the path of the device file the rig installs in it, or `null`; `disabled`, whether the selected mode of a mux disables it; `offers`, the generation and lanes the socket offers, as Pass 4 rates a link, or `null` when it states no lane count; `needs`, the generation and lanes of the installed device's PCIe link, or `null` when the socket is empty or the device does not run PCIe |

`parent` is the node's parent id, or `null` for a root or a controller. Sockets inside adapters are not in the layout.

## Page

The page builds a rig on a board and shows what the board makes of it.

### Files

The page carries every file under `data/` as `files`, keyed by its path under `data/`. Files the user loads are added under `local/<file name>`, replacing a loaded file of the same name. A file whose name contains `/` or `\`, or is `.` or `..`, is not added, and the page says so. Loaded files stay in the browser and are sent nowhere. Text from a file, whether carried, loaded or edited, reaches the page only as text and is never interpreted as HTML.

One control loads TOML files, chosen from disk or dropped anywhere on the page. `catalog` decides what each file is:

| Kind | Effect |
| --- | --- |
| Board | Added to the boards and chosen |
| Device | Added to the parts |
| Rig | Added to the rigs and applied |
| Invalid | Its message is reported with the file name |

Another control loads a data root from a public GitHub repository, at an address the user gives: `https://github.com/<owner>/<repo>` for the root of its default branch, or `https://github.com/<owner>/<repo>/tree/<ref>/<path>` for the folder `<path>` at the branch, tag or commit `<ref>`, where `<ref>` contains no `/`. Every file in that folder or below whose name ends in `.toml` is added under `github/<owner>/<repo>/`, followed by its path from that folder, replacing the files loaded from that repository before. A path that a rig from the repository names is read from the repository's files first, so the repository may hold any number of boards, devices and rigs, and files of the same name in different folders. The boards and devices are added to their lists, and the rigs to theirs without being applied, unless the repository holds exactly one rig. A file longer than 1 MiB, or whose path contains `\`, `:` or a control character, is not added, and the page names it. When the address names no public repository, when the folder holds no TOML file or more than 200, or when GitHub refuses because the page has asked it too often, the page says so and adds nothing. The page asks GitHub without signing in, and remembers neither the address nor the files.

### The rig

The page keeps the rig being built as a rig file at `local/rig.toml` in `files`, on the board chosen, and evaluates it with `check` and `layout` on every change. Choosing another board empties the rig.

The parts are the devices in `files`, each shown with its name and its interface. A part is placed by selecting it and then a socket, or by dragging it onto a socket. Only a socket whose category is the part's `socket_category` takes it; such sockets are marked while a part is selected. Anything else dropped on a socket is ignored. A part placed in an occupied socket replaces the device there. A device is removed from its socket by a control on the socket.

The rigs are the rig files in `files`, each shown with its name. A rig is applied when it is loaded or chosen from the rigs: its board is chosen and its bindings installed. A path it names that is not in `files` is taken from the loaded file whose name is the path's last segment, whenever that file was loaded; a path neither supplies is reported by name. A listed rig is marked while the rig being built has its board and bindings.

The rig being built is exported as a zip archive that unpacks into a data root: the rig at `rigs/<name>.toml`, and each file it names at its path in `files`, except that a loaded board is placed at `boards/<file name>` and a loaded device at `devices/<file name>`, where the exported rig names them. The rig's name is that of the marked rig, or `rig` if none is marked, and names the archive. Its files are stored uncompressed.

### The editor

A control on each board, part and rig in the lists opens its file in an editor beside the bracket, as text. Each edit replaces the file's text in `files` under its path, and the page evaluates the change as it evaluates any other. A text longer than 1 MiB, or one that `catalog` cannot read, is not taken: the page says why, with the line at fault when there is one, and the bracket and the report keep what they last showed. An edited file is saved as a download of that file, or with the rig in the exported archive; otherwise its edits last only while the page is open.

The editor colours the text as TOML. It offers to complete the key being typed with the keys a board, a device or a rig may hold at that place, and the value after `=` with the values its field may take when those are listed, such as the categories of a socket. When a text is not taken, the editor marks the line at fault.

While a rig is open in the editor, it is the rig being built. It is applied when it is opened and whenever an edit to it is taken. Each change the page makes to the rig being built, placing or removing a part, clearing the rig or choosing another board, is written into the rig's text with `rebind` and shown in the editor. A binding the change leaves alone keeps the path the rig names, including one whose file was not loaded; a new path is written as its path in `files`, without the prefix `github/<owner>/<repo>/` when the rig and the file come from the same repository.

### New files

A control beside the heading of the boards creates a board, and one beside the heading of the parts creates a card, an M.2 module, an adapter or a display, chosen from a menu. The new file is the smallest of its kind that `catalog` reads, with each required field holding an example value: a board has one root and one PCIe slot under it, and an adapter one downstream socket. It is added under `local/new-<kind>.toml`, where `<kind>` is `board`, `card`, `m2-module`, `adapter` or `display`. When that path is already in `files`, it is added under `local/new-<kind>-<n>.toml` instead, with the smallest `<n>` from 2 whose path is not, so that a new file never replaces another. It then takes the effect a loaded file of its kind takes, and opens in the editor. The example values are unspecified.

A control beside the heading of the rigs, enabled while a board is chosen, creates a rig: the rig being built, on its board and with its bindings. It is added under `local/new-rig.toml`, or under `local/new-rig-<n>.toml` as a new file of another kind is, and is named after its file without `.toml`. It is applied, which leaves the rig being built as it was and marks the new rig, and opens in the editor.

### The bracket

Each root is drawn as a bracket: its sockets at the leaves on the left, joined through muxes and bridges to the root on the right. Roots are drawn in order of generation, then of the lanes they supply, highest first, then of id. A line runs from each child to the join of its siblings, and from the join to their parent. The lines are one width and meet at their centres, so a line continues straight through a join. A mux shows the position, counted from 1, of its selected mode, or that no mode holds; a bridge shows the lanes it demands. Sockets whose parent is `unknown` are drawn together apart from the roots. Controllers are not drawn.

A socket shows its id, the device in it and two bars on one scale of Gbps: what the device needs above what the socket offers. Each bar has one block per lane, as wide as the rate of a lane of its generation, so that the bars compare both lane count and generation. The scale is the board's: the longest socket bar on the board is drawn at one fixed width, whatever the board. The part of the upper bar beyond the lower is marked as a shortfall, and the part of the lower bar beyond the upper is drawn faded. An empty socket shows only what it offers, and a socket that offers nothing shows no bars. A socket a mux disables is drawn struck out.

A root shows two bars in lanes, one block per lane: the lanes its children demand above the lanes it supplies. The longest root bar on the board is drawn at the same fixed width. Demanded lanes beyond the supply are marked as an overcommit.

A bar of more than 64 lanes, socket or root, is drawn as at most two blocks instead of one per lane: the lanes up to the point where its marking starts, and the lanes beyond. Its length and its marking are those of the bar drawn lane by lane.

### The report

The page shows the status of the report, each diagnostic with its severity, message and code, and the link of each rated device.

### Appearance

The boards, the parts and the rigs are listed in a sidebar on the left, the report is in a sidebar on the right, and the bracket takes the space between them. The header colours a frame around the window, and the bracket and each list of the two sidebars each lie in an inset with small rounded corners sunk into that frame; the insets of a sidebar are stacked with the gap that lies between the sidebars and the bracket. The bracket fills the height below the header, as the insets of each sidebar do together with the control at its foot, and each inset scrolls within itself, so that the page does not scroll and the header and the other insets stay in place. Dragging the inner edge of a sidebar, or moving it with the arrow keys, changes the sidebar's width between 180 and 480 pixels, and the browser remembers the width; a double click on the edge restores the width it starts with. The heading of each list in the left sidebar, the boards, the parts and the rigs, collapses the list below it to the heading alone and opens it again; the lists left open share the height of the sidebar, and the browser remembers which are open. The control beside a heading that creates a file neither collapses nor opens its list. Dragging the gap between two insets of either sidebar, or moving it with the arrow keys, moves height between the open lists above and below it, none shorter than 80 pixels, and the browser remembers the heights; a list that collapses gives its height to the lists left open in proportion to theirs, and a double click on a gap restores the heights the lists start with. On a narrow screen the gaps do not move. Each heading in the sidebars shows the icon of its list at the end away from the bracket. A control at the foot of each sidebar, below its insets and as wide as they are, collapses it to a narrow column in which each inset shrinks to its icon alone, stacked from the top, and the control stretches to fill the height they leave; an icon in the column, or the control, opens it again; the browser remembers whether each sidebar is open. While the pointer rests on a collapsed sidebar, the sidebar opens at its width over the bracket, which stays where it is and shows through the gaps between the insets, and it collapses again when the pointer leaves it. As a sidebar opens, its icons stay where they are while it widens and the rest of their headings appears beside them, and once it has widened its lists open below their headings; as it collapses, its lists close first and then it narrows. A sidebar just collapsed by its control stays collapsed until the pointer has left it. On a narrow screen the three are stacked in that order and the page scrolls through them, a collapsed sidebar is one row of its icons, and the header shows its controls as icons alone.

The controls in the header are icons, each named in its tooltip: loading files, loading files from GitHub, clearing the rig, exporting the rig, switching between the light and the dark theme, and a cog that opens the settings.

The settings choose the theme, which is the system's light or dark theme, light, or dark, and whether the header shows the names of its controls beside their icons. The browser remembers both. Switching or choosing a theme reveals it in a circle growing from the control, or at once when the system asks for reduced motion. The page is drawn in its theme from the first paint, and the sidebars and the bracket hold their places while the module loads, so that loading the page neither flashes another theme nor rearranges it. The page does not scroll sideways; a part of it that must scroll has a thin scrollbar in the theme's colours, shown while the pointer is over that part.

## Build

The Wasm module is `mblint-wasm` built for `wasm32-unknown-unknown`, then wrapped as an ES module with its TypeScript declarations by the `wasm-bindgen` command line. The command line must be the version of the `wasm-bindgen` crate in `Cargo.lock`.

The page is published at mblint.shortarrow.jp as a Cloudflare Worker serving the static assets in `web/dist`, configured in `web/wrangler.jsonc`. Cloudflare Workers Builds deploys `main` and builds other branches as previews, running `web/scripts/cloudflare-build.sh`, which installs Rust and the `wasm-bindgen` command line before building the page.

Every response carries the Content Security Policy in `web/public/_headers`. It runs scripts and Wasm only from the page's own origin, so `index.html` holds no inline script; takes styles from the page and Google Fonts, and fonts from Google Fonts; fetches only from the page, GitHub's API and its host of raw files; and lets no other site frame the page.

The keys and the listed values the editor offers are generated from the core's Rust types of the board, the device and the rig, and CI fails when the ones committed differ from what is generated.

The TypeScript types of the reports, the catalog and the layout are generated from the core's Rust types by ts-rs, one file per type, into `web/src/report/`. `cargo test -p mblint-core --features ts` writes them, and CI fails when the files committed there differ from what it writes. The diagnostic type of each pass is named after the pass: `PhysicalDiagnostic`, `LanesDiagnostic`, `TunnelsDiagnostic` and `ThroughputDiagnostic`.

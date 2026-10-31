# Web simulator

[日本語](web.jp.md)

The web simulator runs the core in the browser as Wasm. The page is TypeScript under `web/`; the Wasm module is the crate `mblint-wasm`.

## Wasm interface

The module exports these functions. Each takes the files it may read as an object mapping a path, by the rule for paths in [the data schema](schema.md), to the file's contents.

| Function | Arguments | Returns |
| --- | --- | --- |
| `check(files, rig)` | `files`, and `rig`, the path of the rig file | The report of `mblint check --json` in [the command line](cli.md) |
| `lint(files, board)` | `files`, and `board`, the path of the board file | The report of `mblint lint --json` |
| `catalog(files)` | `files` | What each file is, as in [Catalog](#catalog) |
| `layout(files, rig)` | `files`, and `rig`, the path of the rig file | The rig's board as the page draws it, as in [Layout](#layout) |

Files are read only by the paths the rig or the call names, as the CLI reads them under its data root. A path absent from `files` cannot be read.

When a file cannot be loaded, the function throws an `Error` whose message names the file and why, the message the CLI prints to standard error after `mblint: `. No report is returned.

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

The page carries every file under `data/` as `files`, keyed by its path under `data/`. Files the user loads are added under `local/<file name>`, replacing a loaded file of the same name. Loaded files stay in the browser and are sent nowhere.

One control loads TOML files, chosen from disk or dropped anywhere on the page. `catalog` decides what each file is:

| Kind | Effect |
| --- | --- |
| Board | Added to the boards and chosen |
| Device | Added to the parts |
| Rig | Its board is chosen and its bindings installed. A path it names that is not in `files` is taken from a file loaded with it whose name is the path's last segment; a path neither supplies is reported by name |
| Invalid | Its message is reported with the file name |

### The rig

The page keeps the rig being built as a rig file at `local/rig.toml` in `files`, on the board chosen, and evaluates it with `check` and `layout` on every change. Choosing another board empties the rig.

The parts are the devices in `files`, each shown with its name and its interface. A part is placed by selecting it and then a socket, or by dragging it onto a socket. Only a socket whose category is the part's `socket_category` takes it; such sockets are marked while a part is selected. A part placed in an occupied socket replaces the device there. A device is removed from its socket by a control on the socket.

### The bracket

Each root is drawn as a bracket: its sockets at the leaves on the left, joined through muxes and bridges to the root on the right. Roots are drawn in order of generation, then of the lanes they supply, highest first, then of id. A line runs from each child to the join of its siblings, and from the join to their parent. The lines are one width and meet at their centres, so a line continues straight through a join. A mux shows the position, counted from 1, of its selected mode, or that no mode holds; a bridge shows the lanes it demands. Sockets whose parent is `unknown` are drawn together apart from the roots. Controllers are not drawn.

A socket shows its id, the device in it and two bars on one scale of Gbps: what the device needs above what the socket offers. Each bar has one block per lane, as wide as the rate of a lane of its generation, so that the bars compare both lane count and generation. The scale is the board's: the longest socket bar on the board is drawn at one fixed width, whatever the board. The part of the upper bar beyond the lower is marked as a shortfall, and the part of the lower bar beyond the upper is drawn faded. An empty socket shows only what it offers, and a socket that offers nothing shows no bars. A socket a mux disables is drawn struck out.

A root shows two bars in lanes, one block per lane: the lanes its children demand above the lanes it supplies. The longest root bar on the board is drawn at the same fixed width. Demanded lanes beyond the supply are marked as an overcommit.

### The report

The page shows the status of the report, each diagnostic with its severity, message and code, and the link of each rated device.

### Appearance

The boards and the parts are listed in a sidebar on the left, the report is in a sidebar on the right, and the bracket takes the space between them. The header colours a frame around the window, and the two sidebars and the bracket each lie in an inset with small rounded corners sunk into that frame. Dragging the inner edge of a sidebar, or moving it with the arrow keys, changes the sidebar's width between 180 and 480 pixels, and the browser remembers the width; a double click on the edge restores the width it starts with. A control at the foot of each sidebar collapses it to a narrow rail of icons, and the rail opens it again; the browser remembers whether each sidebar is open. On a narrow screen the three are stacked in that order, and a collapsed sidebar is one row of its icons.

The controls in the header are icons, each named in its tooltip: loading files, clearing the rig, switching between the light and the dark theme, and a cog that opens the settings.

The settings choose the theme, which is the system's light or dark theme, light, or dark, and whether the header shows the names of its controls beside their icons. The browser remembers both. Switching or choosing a theme reveals it in a circle growing from the control, or at once when the system asks for reduced motion. The page is drawn in its theme from the first paint, and the sidebars and the bracket hold their places while the module loads, so that loading the page neither flashes another theme nor rearranges it. The page does not scroll sideways; a part of it that must scroll has a thin scrollbar in the theme's colours, shown while the pointer is over that part.

## Build

The Wasm module is `mblint-wasm` built for `wasm32-unknown-unknown`, then wrapped as an ES module with its TypeScript declarations by the `wasm-bindgen` command line. The command line must be the version of the `wasm-bindgen` crate in `Cargo.lock`.

The page is published at mblint.shortarrow.jp as a Cloudflare Worker serving the static assets in `web/dist`, configured in `web/wrangler.jsonc`. Cloudflare Workers Builds deploys `main` and builds other branches as previews, running `web/scripts/cloudflare-build.sh`, which installs Rust and the `wasm-bindgen` command line before building the page.

The TypeScript types of the reports, the catalog and the layout are generated from the core's Rust types by ts-rs, one file per type, into `web/src/report/`. `cargo test -p mblint-core --features ts` writes them, and CI fails when the files committed there differ from what it writes. The diagnostic type of each pass is named after the pass: `PhysicalDiagnostic`, `LanesDiagnostic`, `TunnelsDiagnostic` and `ThroughputDiagnostic`.

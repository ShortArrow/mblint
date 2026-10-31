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
  "rigs/workstation.toml": { "kind": "rig", "name": "workstation", "board": "boards/asus/proart_x870e_creator_wifi.toml" },
  "notes.toml": { "kind": "invalid", "message": "not a board: …; not a device: …; not a rig: …" }
}
```

| `kind` | Fields |
| --- | --- |
| `board` | `vendor` and `model` of the board |
| `device` | `name` and `type` of the device; `interface`, the device's own link, or `null` for an adapter or a display; `socket_category`, the category of the board socket it is installed in |
| `rig` | `name` of the rig, and `board`, the path of its board |
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

The page carries every file under `data/` as `files`, keyed by its path under `data/`. It lists the boards among them, and shows the lint report of the board chosen: its status and the message of each diagnostic.

## Build

The Wasm module is `mblint-wasm` built for `wasm32-unknown-unknown`, then wrapped as an ES module with its TypeScript declarations by the `wasm-bindgen` command line. The command line must be the version of the `wasm-bindgen` crate in `Cargo.lock`.

The page is published at mblint.shortarrow.jp as a Cloudflare Worker serving the static assets in `web/dist`, configured in `web/wrangler.jsonc`. Cloudflare Workers Builds deploys `main` and builds other branches as previews, running `web/scripts/cloudflare-build.sh`, which installs Rust and the `wasm-bindgen` command line before building the page.

The TypeScript types of the reports, the catalog and the layout are generated from the core's Rust types by ts-rs, one file per type, into `web/src/report/`. `cargo test -p mblint-core --features ts` writes them, and CI fails when the files committed there differ from what it writes. The diagnostic type of each pass is named after the pass: `PhysicalDiagnostic`, `LanesDiagnostic`, `TunnelsDiagnostic` and `ThroughputDiagnostic`.

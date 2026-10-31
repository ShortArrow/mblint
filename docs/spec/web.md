# Web simulator

[日本語](web.jp.md)

The web simulator runs the core in the browser as Wasm. The page is TypeScript under `web/`; the Wasm module is the crate `mblint-wasm`.

## Wasm interface

The module exports two functions. Each takes the files it may read as an object mapping a path, by the rule for paths in [the data schema](schema.md), to the file's contents.

| Function | Arguments | Returns |
| --- | --- | --- |
| `check(files, rig)` | `files`, and `rig`, the path of the rig file | The report of `mblint check --json` in [the command line](cli.md) |
| `lint(files, board)` | `files`, and `board`, the path of the board file | The report of `mblint lint --json` |

Files are read only by the paths the rig or the call names, as the CLI reads them under its data root. A path absent from `files` cannot be read.

When a file cannot be loaded, the function throws an `Error` whose message names the file and why, the message the CLI prints to standard error after `mblint: `. No report is returned.

## Page

The page carries every file under `data/` as `files`, keyed by its path under `data/`. It lists the boards among them, and shows the lint report of the board chosen: its status and the message of each diagnostic.

## Build

The Wasm module is `mblint-wasm` built for `wasm32-unknown-unknown`, then wrapped as an ES module with its TypeScript declarations by the `wasm-bindgen` command line. The command line must be the version of the `wasm-bindgen` crate in `Cargo.lock`.

The page is published at mblint.shortarrow.jp as a Cloudflare Worker serving the static assets in `web/dist`, configured in `web/wrangler.jsonc`. Cloudflare Workers Builds deploys `main` and builds other branches as previews, running `web/scripts/cloudflare-build.sh`, which installs Rust and the `wasm-bindgen` command line before building the page.

The TypeScript types of the reports are generated from the core's Rust types by ts-rs, one file per type, into `web/src/report/`. `cargo test -p mblint-core --features ts` writes them, and CI fails when the files committed there differ from what it writes. The diagnostic type of each pass is named after the pass: `PhysicalDiagnostic`, `LanesDiagnostic`, `TunnelsDiagnostic` and `ThroughputDiagnostic`.

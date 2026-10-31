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

When a file cannot be loaded, the function throws an `Error` whose message names the file and why, the message the CLI prints to standard error. No report is returned.

The page's TypeScript types for the reports are generated from the core's Rust types.

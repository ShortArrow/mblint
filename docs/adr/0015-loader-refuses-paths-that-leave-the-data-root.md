# ADR-0015: The loader refuses, by their spelling, paths that could leave the data root

[日本語](0015-loader-refuses-paths-that-leave-the-data-root.jp.md)

- Status: Accepted

## Context

Rig files name their board and devices by paths relative to the data root, and `load_rig` passes each path to a reader that the front end supplies. The CLI's reader joined the path to the data root and read the result, so a rig naming `../../x` or an absolute path made the CLI read a file outside the data root, and a parse error quotes the offending line on standard error. Rigs may come from other people, and a planned MCP server will read rigs that an LLM writes. The PRD requires the same input to give the same result on every OS and under Wasm, where there is no file system to resolve paths against.

## Decision

- A path is names separated by `/`; no name is empty, `.` or `..`, or contains `\` or `:`.
- `load_rig` checks every path, the rig's own included, before handing it to the reader, and returns `LoadError::InvalidPath` for one that breaks the rule. The CLI exits 2 on it, as on any load failure.
- Symbolic links inside the data root are followed as the reader finds them.

## Rationale

- Checking in the core gives the CLI, the Wasm build and the MCP server one rule, and no reader can forget it.
- A rule on the spelling alone answers the same on every OS and under Wasm, and refuses Windows drive and UNC forms on Unix too.
- Refusing `\` and `:` keeps a path that is harmless on one OS from being absolute or a drive on another.

## Alternatives not taken

- Resolving the joined path with `canonicalize` and checking that it starts with the data root: it needs a file system, so Wasm could not apply it, and it refuses a symbolic link that the person who arranged the data root placed on purpose.
- Checking in the CLI's reader only: each later front end would need the same check.

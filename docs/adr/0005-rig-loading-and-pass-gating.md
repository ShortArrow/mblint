# ADR-0005: Rigs are loaded through a caller-supplied reader, and a failing pass stops the passes after it

[日本語](0005-rig-loading-and-pass-gating.jp.md)

- Status: Accepted

## Context

A rig names its board and devices by path. The PRD examples write those paths from the root of the data (`boards/msi/...`, `devices/cards/...`), not from the rig file. `mblint-core` must run both natively and as Wasm in a browser, where there is no file system and files arrive by drag and drop. The PRD's pipeline proceeds to the next pass only if the previous one passed, but did not say how a pass that did not run is reported.

## Decision

- Paths in a rig are relative to the data root, the directory that contains `boards/`, `devices/` and `rigs/`.
- `mblint-core` does no file I/O. Loading a rig takes a reader supplied by the caller, which maps a data-root-relative path to the file's contents. The CLI reads the file system; the web build reads the files it was given.
- The evaluation result holds each pass's outcome in pipeline order. When a pass reports an error, the passes after it are not run, and the result records them as not run rather than as passed.

## Rationale

- Data-root-relative paths match the PRD examples, and a device file is named the same way from every rig that uses it.
- With the reader outside the core, native and Wasm builds run the same loading code.
- Telling "not run" apart from "passed" keeps a rig with a physical error from looking electrically sound.

## Alternatives not taken

- Paths relative to the rig file: every rig would spell the same device differently, depending on where it sits.
- Running every pass regardless of earlier errors: later passes would reason about devices that cannot be installed as bound, and report problems that are consequences of the first one.

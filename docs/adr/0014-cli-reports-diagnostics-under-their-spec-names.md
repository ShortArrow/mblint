# ADR-0014: The CLI reports each diagnostic under its specification name, from a report built in the core

[日本語](0014-cli-reports-diagnostics-under-their-spec-names.jp.md)

- Status: Accepted

## Context

The PRD asks for `mblint check <rig.toml>` with output for people and `--json` output for AI agents and scripts. Its JSON example names diagnostics `BANDWIDTH_TUNNELING_BOTTLENECK` and `VFIO_IOMMU_GROUP_SHARED`, puts them all under `warnings`, and carries values that the rig it accompanies does not produce: `theoretical_max_gbps = 64.0` for a PCIe 4.0 x16 card, and an IOMMU group shared by `PCI_E2`, which the rig leaves empty. The passes already name their diagnostics, such as `Bottleneck` and `SharedIommuGroup`. Rig, board and device files name each other by paths relative to a data root, and `load_rig` reads them through a reader that takes those paths. The PRD also requires that the same input produce the same result on every OS and under Wasm, which a later web build will run.

## Decision

- The first CLI command is `mblint check [--data-root <dir>] [--json] <rig>`. The rig path is relative to the data root, which is the current directory unless `--data-root` gives one.
- `mblint-core` turns an evaluation into a serializable report: a status, the state of each pass, every diagnostic with its pass, severity, code and message, and the rated links. The CLI writes that report as JSON or as text.
- A diagnostic's `code` is its name in the specification, in upper snake case.
- The exit status is 0 without errors, 1 with errors, and 2 when the arguments or the files cannot be used.
- The text layout and the wording of messages are not part of the output's contract.
- The PRD's JSON example is replaced by the report of the PRD's own rig. This settles the open issue that the example's values matched neither the card's link nor the rig.

## Rationale

- One set of names across the specification, the code and the output lets a reader of the JSON find each diagnostic's meaning in `passes.md` without a mapping.
- A report built in the core is the same for the CLI and the Wasm build, so the determinism requirement holds by construction rather than by keeping two encoders in step.
- Paths relative to the data root are the ones every file already uses, so the CLI reads files the same way the tests do and adds no rule for finding the data root.
- Exit status 1 only for errors lets a script fail a build on a configuration that does not work, while warnings, which describe a working but slower build, pass.
- Leaving text and wording open lets them improve without breaking scripts, which read codes and fields.

## Alternatives not taken

- The PRD's codes, such as `BANDWIDTH_TUNNELING_BOTTLENECK`: they name a cause the pass does not determine, since a bottleneck may come from a tunnel cap, a mux split or a slow socket, and would need a second vocabulary kept in step with the first.
- Separate `errors` and `warnings` arrays: a diagnostic's severity is a field of it, and one list keeps the passes' order.
- Finding the data root from the rig file's location, such as the parent of `rigs/`: it adds an implicit rule, and a rig outside `rigs/` would need the flag anyway.
- Serializing in the CLI only: the Wasm build would need its own encoder of the same report.
- Rounding bandwidth figures in JSON: consumers comparing figures would lose precision the passes have.

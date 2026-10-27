# Open issues in PRD v2.0

[日本語](open-issues.jp.md)

Points of the [PRD](../prd.md) that need agreement before they are implemented. A decided point moves to an ADR or the relevant specification and is removed from this list.

Ordered by impact.

## Schema

| # | Section | Undecided |
| --- | --- | --- |
| 1 | 4.1 `modes[].when` | The notation is settled by [ADR-0001](../adr/0001-mux-mode-condition-as-structured-toml.md), and a mux with no matching mode reports `NoMatchingMode` and allocates nothing. How to combine several conditions in one mode is undecided. |
| 3 | 4.2 / 5 Pass 1 | There is no schema for cards (`devices/cards/*.toml`, `devices/ssds/*.toml`). Where Pass 1 reads thickness, length, physical lane width and required bandwidth is undecided. |

## Inconsistent example data

| # | Section | Problem |
| --- | --- | --- |
| 6 | 4.1 `mux_m2_sata_exclusive` | Following the draft's note, the example disables `SATA_5` and `SATA_6` in PCIe mode ([ADR-0003](../adr/0003-mux-modes-share-one-shape.md)). Whether the real board disables them in PCIe or in SATA mode must be confirmed against the manual. |
| 7 | 6.1 JSON | `theoretical_max_gbps = 64.0` for an RTX 3060 (PCIe Gen4 x16) matches neither Gen4 x16 (about 252 Gbps) nor Gen4 x8. `PCI_E2` is not used by the rig in 4.3. |
| 8 | 4.2 example 1 | `max_tunneling_gbps = 32.0` is described as PCIe Gen3 x4, whose effective rate is about 31.5 Gbps. Whether bandwidth figures are raw or after line encoding is undefined. |

## Behaviour

| # | Section | Undecided |
| --- | --- | --- |
| 9 | 5 | "Proceed if passed" means a failing pass suppresses the diagnostics of later passes. Whether the CLI output reports a pass as `skipped` is undecided. |
| 10 | 4.1 `root_pch_hsio` | `bus = "hsio"` lanes are shared among PCIe, SATA and USB. Apart from `allocate`, there is no way to state how many HSIO lanes a socket consumes. |

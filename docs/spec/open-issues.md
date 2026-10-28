# Open issues in PRD v2.0

[日本語](open-issues.jp.md)

Points of the [PRD](../prd.md) that need agreement before they are implemented. A decided point moves into the specification under `docs/spec/` and is removed from this list.

Ordered by impact.

## Schema

| # | Section | Undecided |
| --- | --- | --- |
| 1 | 4.1 `modes[].when` | `when` holds a single condition. How to combine several conditions in one mode is undecided. |
| 12 | 4.3 Rig | A board file describes the BIOS at its default settings. How a rig states a BIOS setting that moves lanes, such as giving M.2 slot lanes shared with a USB4 controller to the slot alone, is undecided. |

## Inconsistent example data

| # | Section | Problem |
| --- | --- | --- |
| 7 | 6.1 JSON | `theoretical_max_gbps = 64.0` for an RTX 3060 (PCIe Gen4 x16) matches neither Gen4 x16 (about 252 Gbps) nor Gen4 x8. `PCI_E2` is not used by the rig in 4.3. |

## Behaviour

| # | Section | Undecided |
| --- | --- | --- |
| 10 | 4.1 `root_pch_hsio` | `bus = "hsio"` lanes are shared among PCIe, SATA and USB. Apart from `allocate`, there is no way to state how many HSIO lanes a socket consumes. |
| 11 | 4.1 `M2_2.supported_protocols` | Which pass rejects a module whose protocol the M.2 slot does not support, such as a SATA SSD in a PCIe-only slot, is undecided. The module fits physically, so Pass 1 does not report it. |
| 13 | 4.1 Roots | Devices behind a chipset share its link to the CPU, PCIe 4.0 x4 on AMD X870E. A root states the lanes it supplies but no shared upstream bandwidth, so the passes do not see that link saturate. |
| 14 | 4.1, 4.3 | A board's lanes depend on the CPU installed: on the MSI MAG X870E TOMAHAWK WIFI, a Ryzen 8500 or 8300 runs PCI_E1 at PCIe 4.0 x4 and leaves M2_2 unavailable. A board file describes one CPU family. How a rig names its CPU is undecided. |

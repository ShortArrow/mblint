# ADR-0012: A board PCIe slot may state its electrical lanes

[日本語](0012-board-pcie-slots-state-electrical-lanes.jp.md)

- Status: Accepted

## Context

Pass 4 takes a board socket's lanes from a mux's `allocate`, or else from `max_lanes`, which only an `m2_slot` has. On the MSI MAG X870E TOMAHAWK WIFI no PCIe slot is behind a mux: PCI_E1 is wired x16 to the CPU, and PCI_E2 and PCI_E3 are wired x1 and x4 to the chipset, all three in x16-long slots. Such a slot had no lane count, so every card in it was reported as an unrated link. An adapter's `pcie_slot` already states `max_electrical_lanes`.

## Decision

- A board `pcie_slot` takes an optional `max_electrical_lanes`.
- Pass 4 gives a board `pcie_slot` the lanes a mux allocates to it, or else its `max_electrical_lanes`.

## Rationale

- A slot's electrical width is often narrower than its physical form factor, so it cannot be derived from `physical_form_factor`.
- The field has the same name and meaning as on an adapter's `pcie_slot`.

## Alternatives not taken

- Putting each slot behind a mux whose modes allocate a fixed width: a mux describes switching, and a mux that never switches would misdescribe the board.
- Reusing `max_lanes`: on a PCIe slot the established term in this schema is the one adapters already use.

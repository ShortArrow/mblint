# ADR-0011: A board socket may state a generation below its root's

[日本語](0011-board-sockets-cap-their-generation.jp.md)

- Status: Accepted

## Context

A board socket took the PCIe generation of the root it descends from. On the MSI MAG X870E TOMAHAWK WIFI, the X870E chipset provides PCIe 4.0 to PCI_E3, M2_3 and M2_4, but PCI_E2 behind the same chipset runs only PCIe 3.0 x1. The board could only be described by inventing a second chipset root for the one slot. An adapter's `pcie_slot` already states its own `generation`.

## Decision

- A board `pcie_slot` and `m2_slot` take an optional `generation`.
- Pass 4 gives a board socket the smaller of its `generation` and the generation of its root. A socket without `generation` has its root's.

## Rationale

- The slower generation is a property of the slot's wiring, so it belongs on the slot.
- Taking the smaller of the two means a socket can never be rated faster than the root that feeds it, whatever it states.
- The field has the same name and meaning as on an adapter's `pcie_slot`.

## Alternatives not taken

- A second root for the slower slot: roots supply lanes, and a chipset that is split into two roots would no longer show which sockets share it.
- Making `generation` required on board sockets: most sockets run at their root's generation, and repeating it in every socket invites the two to disagree.

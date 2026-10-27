# ADR-0010: A mux allocates lanes to bridges as well as to sockets

[日本語](0010-muxes-allocate-lanes-to-bridges.jp.md)

- Status: Accepted

## Context

On the MSI MAG X870E TOMAHAWK WIFI, the M2_2 slot and the ASM4242 USB4 controller share four PCIe 5.0 lanes from the CPU. The manual states: "Both run at PCIe 5.0 x2 when a device is installed in the M2_2 slot." With M2_2 empty, the controller has all four lanes. A setting in the BIOS gives M2_2 all four lanes and disables the USB4 ports. A mux's `allocate` named only sockets, and a bridge drew a fixed `upstream_lanes` from its parent, so the lanes a bridge receives could not depend on which sockets are occupied.

## Decision

- A mode's `allocate` is keyed by socket id or bridge id.
- A bridge whose parent is a mux draws the lanes the selected mode allocates to it. A bridge whose parent is a root demands its `upstream_lanes` from the root, as before.
- Modes selected by a BIOS setting are not described. A board file describes the board with its BIOS at the default settings.

## Rationale

- A mux already expresses lanes moving between consumers as sockets are filled. A bridge is one more consumer of the same lanes, so extending the keys of `allocate` adds no new mechanism.
- A mux's `parent` is the only demand that reaches a root, so a bridge under a mux is counted once, through the mux.

## Alternatives not taken

- A dedicated `shares_with` field on the bridge: it would describe the same switching that a mux already describes, in a second form that the passes would have to evaluate separately.
- Modelling the BIOS setting now: the rig has no place to state BIOS settings, and the default is what a build has until someone changes it.

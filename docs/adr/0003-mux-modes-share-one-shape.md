# ADR-0003: Every mux mode has the same shape

[日本語](0003-mux-modes-share-one-shape.jp.md)

- Status: Accepted
- Date: 2026-10-27

## Context

The PRD drafted bifurcation modes with `allocate` and exclusive modes with `active_targets` and `cost_lanes`, and conditioned exclusive modes on the protocol a device runs. Its example listed `SATA_5` and `SATA_6` in `active_targets` of the SATA mode while its note said they are disabled in PCIe mode, so the meaning of `active_targets` could be read either way. The PRD also requires that protocols are not handled by separate code paths.

## Decision

Every mux mode, whatever the mux's `subtype`, has these fields:

| Field | Meaning |
| --- | --- |
| `when` | The condition under which the mode applies |
| `allocate` | Lanes each socket receives from the mux's parent; empty if omitted |
| `disables` | Sockets that stop working while the mode applies; empty if omitted |

`when` takes one of two forms:

```toml
when = { socket = "PCI_E2", is = "occupied" }   # or "empty"
when = { socket = "M2_2", protocol = "pcie" }   # or "sata"
```

A protocol condition holds only while the socket is occupied by a device running that protocol.

`subtype` (`bifurcation`, `exclusive`) describes the hardware for readers and does not change how modes are evaluated. `active_targets` and `cost_lanes` are removed; `cost_lanes = 4` is written as `allocate = { M2_2 = 4 }`.

A mux must have a mode for every state of the sockets it switches, including empty; otherwise resolution reports that no mode matches.

## Rationale

- One mode shape means one evaluation path for every mux.
- `disables` names what is lost, which is what a user needs to be warned about, and has only one reading.

## Alternatives not taken

- A field set per subtype: keeps the PRD's draft notation, but each subtype needs its own evaluation and its own validation.

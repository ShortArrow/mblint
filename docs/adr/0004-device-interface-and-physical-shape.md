# ADR-0004: Devices declare their interface and physical shape separately

[日本語](0004-device-interface-and-physical-shape.jp.md)

- Status: Accepted
- Date: 2026-10-27

## Context

Pass 1 checks that a device fits its socket and that cards do not cover each other, and Pass 2 needs the protocol each device runs. The PRD gave schemas for adapters and displays but none for expansion cards and M.2 modules, and the board's sockets carried their physical attributes as free-form fields of every category.

## Decision

A device file declares what it speaks in `[interface]` and what it occupies in `[physical]`. Two device types are defined first:

```toml
# devices/cards/<id>.toml
type = "card"

[interface]
protocol = "pcie"
generation = 4
lanes = 16                    # electrical lanes

[physical]
edge = "x16"                  # card edge connector: x1, x4, x8 or x16
thickness_slots = 3           # bracket positions covered, its own included
length_mm = 304
```

```toml
# devices/ssds/<id>.toml
type = "m2_module"

[interface]
protocol = "pcie"             # or "sata"
generation = 5
lanes = 4

[physical]
keys = ["M"]                  # notches cut in the module: B, M or both
form_factor = "2280"
```

A board socket's attributes depend on its `category`, and each category has a fixed set:

| `category` | Physical attributes |
| --- | --- |
| `pcie_slot` | `slot_index`, `physical_form_factor`, `open_ended` (default `false`) |
| `m2_slot` | `key` (`B`, `E` or `M`) |
| `sata_port`, `usb_c` | none yet |

Pass 1 applies these rules:

- A card fits a PCIe slot if its edge is no wider than the slot, or if the slot is open-ended.
- An M.2 module fits a slot if the slot's key is among the module's `keys`.
- A card in slot index *i* with thickness *t* covers indices *i* to *i* + *t* − 1. Slot indices count away from the CPU, the direction in which an ATX card's cooler extends. A device in a covered slot is reported as obstructed.
- A card in a socket that is not a PCIe slot, or a module in a socket that is not an M.2 slot, does not fit.

## Rationale

- Keeping interface and shape apart lets Pass 1 read only `[physical]` and Pass 2 only `[interface]`.
- Typing socket attributes by category rejects a misspelt or misplaced attribute when the board is parsed.
- Listing a module's keys covers B+M modules without a separate key value for them.

## Alternatives not taken

- Thickness in millimetres: closer to the data sheet, but every check would have to convert it to slot positions with an assumed slot pitch.
- A single device type with optional fields: every check would have to handle combinations no real device has.

## Consequences

Thickness is rounded up to whole slot positions by whoever writes the device file, so a 3.5-slot card is written as `thickness_slots = 4`. `length_mm` and `form_factor` are recorded but not yet checked, because the board's geometry around each slot is not modelled.

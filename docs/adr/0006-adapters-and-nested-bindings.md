# ADR-0006: Adapters expose sockets that rigs bind to by dotted path

[日本語](0006-adapters-and-nested-bindings.jp.md)

- Status: Accepted

## Context

An eGPU box or a USB-to-SATA enclosure is installed into a board socket and has sockets of its own. The PRD gives adapter examples with `[upstream]`, `[bridge]` and `[downstream_sockets]`, and a rig binding such as `"PORT_TYPEC_1.EGPU_SLOT"`, but did not say how such a binding is resolved, which board sockets an adapter fits, or how the sockets inside an adapter are checked.

## Decision

An adapter is a device of `type = "adapter"`:

| Table | Fields |
| --- | --- |
| `[upstream]` | `connector` (`type_c` or `type_a`), `protocol` it runs towards the board, optional `max_gbps` |
| `[bridge]` | `translates_to` (the protocol of its downstream side), optional `chipset`, `max_tunneling_gbps`, `sata_generation` |
| `[downstream_sockets.<NAME>]` | `category` and the attributes of that category; none if omitted |

A downstream socket of category `pcie_slot` has `physical_form_factor`, `open_ended` (default `false`), `max_electrical_lanes` and `generation`.

A rig binds a device into an adapter's socket with the key `<path of the adapter>.<NAME>`. The path of the adapter may itself be dotted, so adapters nest to any depth. Board node ids therefore contain no `.`.

Pass 1 applies one set of fit rules to board sockets and downstream sockets alike:

| Device | Fits |
| --- | --- |
| `card` | a `pcie_slot` whose width or open end admits its edge |
| `m2_module` | an `m2_slot` whose key is among its notches |
| `adapter` with `connector = "type_c"` | a `usb_c` socket |
| `adapter` with `connector = "type_a"` | a `usb_a` socket |

A binding whose path does not lead to a socket — the parent path holds no adapter, or the adapter has no socket of that name — is an unknown socket. Obstruction is checked only between board slots, because a downstream socket has no position on the board.

Pass 2 sees an adapter as a device running its upstream protocol in the board socket. Devices inside the adapter do not draw on the board's lanes.

## Rationale

- One set of fit rules for both kinds of socket keeps a card in an eGPU box under the same check as a card on the board.
- The dotted path is what the PRD's rig example already writes, and it extends to a hub inside a hub without a new notation.

## Alternatives not taken

- A separate `[nested]` table in the rig per adapter: adds a second binding notation that means the same thing.

## Consequences

Bandwidth through an adapter — `max_gbps`, `max_tunneling_gbps`, `max_electrical_lanes` — is recorded but not yet evaluated; that belongs to Passes 3 and 4.

# Resolution passes

[日本語](passes.jp.md)

Evaluating a rig runs the passes in order. When a pass reports an error, the passes after it are not run, and the result records them as not run rather than as passed.

Files are read through a reader supplied by the caller, which maps a data-root-relative path to the file's contents. `mblint-core` does no file I/O itself, so the CLI and the Wasm build share the same loading code.

## Pass 1: physical layer

Every Pass 1 diagnostic is an error.

### Fit

Board sockets and adapter sockets are checked by the same rules:

| Device | Fits |
| --- | --- |
| `card` | A `pcie_slot` no narrower than its edge, or an open-ended one |
| `m2_module` | An `m2_slot` whose key is among the module's `keys` |
| `adapter` with `connector = "type_c"` | A `usb_c` socket |
| `adapter` with `connector = "type_a"` | A `usb_a` socket |

A device in a socket of any other category is in the wrong socket category. A socket path that leads to no socket is an unknown socket: the id names no board socket, the parent path holds no adapter, or the adapter has no socket of that name.

`length_mm` and `form_factor` are not checked.

### Obstruction

A card in slot index *i* with thickness *t* covers indices *i* to *i* + *t* − 1. A device in another board slot within that range is obstructed. Obstruction is checked only between board slots, because an adapter's socket has no position on the board.

### Diagnostics

| Diagnostic | Reported when |
| --- | --- |
| `UnknownSocket` | A binding's socket path leads to no socket |
| `WrongSocketCategory` | The device is not made for the socket's category |
| `EdgeTooWide` | A card edge is wider than a closed-ended slot |
| `KeyMismatch` | The slot's key is not among the module's notches |
| `Obstructed` | A card covers the slot holding another device |

Fit diagnostics come first, ordered by socket path, followed by obstructions ordered by the obstructed socket. A slot covered by several cards is reported once, against the card with the smallest socket id.

## Pass 2: electrical exclusivity and mux resolution

### Occupancy

Pass 2 sees the devices bound to board sockets. A card or M.2 module runs the protocol of its `[interface]`, and an adapter runs its upstream protocol. Devices inside an adapter draw no lanes from the board.

### Mode selection

Each mux selects the first of its modes, in declaration order, whose `when` holds. Each socket in the selected mode's `allocate` receives that many lanes. A mux with no mode that holds allocates nothing.

### Lane balance

A mux demands the sum of its selected mode's `allocate`, and a bridge demands its `upstream_lanes`, both from their direct parent. A socket draws lanes only through a mux's `allocate`. A root whose demand exceeds its `lanes` is overcommitted.

### Diagnostics

| Diagnostic | Reported when |
| --- | --- |
| `NoMatchingMode` | No mode of a mux holds |
| `SocketDisabled` | A device is installed in a socket that the selected mode of a mux disables |
| `LaneOvercommit` | A root's demand exceeds its supply |

Diagnostics are grouped by kind in the order of this table, each group ordered by node id. Which Pass 2 diagnostics are errors is unspecified.

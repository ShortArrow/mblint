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
| `display` | A `usb_c` socket |

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

Every Pass 2 diagnostic is an error.

### Occupancy

Pass 2 sees the devices bound to board sockets. A card or M.2 module runs the protocol of its `[interface]`, an adapter runs its upstream protocol, and a display runs `displayport`. Devices inside an adapter draw no lanes from the board.

### Protocol support

A device in an `m2_slot` whose `supported_protocols` is not empty must run one of those protocols. An empty `supported_protocols` is not checked.

### Mode selection

Each mux selects the first of its modes, in declaration order, whose `when` holds. Each socket or bridge in the selected mode's `allocate` receives that many lanes. A mux with no mode that holds allocates nothing.

### Lane balance

A mux demands the sum of its selected mode's `allocate` from its parent, and a bridge whose parent is a root demands its `upstream_lanes` from the root. A `pcie_slot` or `m2_slot` whose parent is a root demands its `max_electrical_lanes` or `max_lanes` from the root, whether or not a device is installed in it. It demands nothing if the value is not stated or the selected mode of a mux disables it. Any other socket, and a socket or bridge under a mux, draws lanes only through a mux's `allocate`. A root whose demand exceeds its `lanes` is overcommitted.

### Diagnostics

| Diagnostic | Reported when |
| --- | --- |
| `NoMatchingMode` | No mode of a mux holds |
| `SocketDisabled` | A device is installed in a socket that the selected mode of a mux disables |
| `ProtocolUnsupported` | A device runs a protocol that its `m2_slot` does not support |
| `LaneOvercommit` | A root's demand exceeds its supply |

Diagnostics are grouped by kind in the order of this table, each group ordered by node id.

## Pass 3: tunnelling and protocol bridges

### Tunnel caps

Pass 3 computes the tunnel cap of each socket path inside an adapter: the smallest `max_tunneling_gbps` among the adapters that enclose the path. A path that no such adapter encloses has no cap.

### DP Alt Mode

A display in a board `usb_c` socket takes `required_dp_lanes` of the port's DP Alt Mode lanes. When it takes four, no lanes are left for USB 3 data, and USB data on the port runs at USB 2.0. On a port whose `dp_alt_max_lanes` is `"unknown"`, whether the display gets its lanes is not known, and Pass 3 reports only that.

### Diagnostics

| Diagnostic | Severity | Reported when |
| --- | --- | --- |
| `DpAltModeUnsupported` | error | A display is in a port without `dp_alt_max_lanes` |
| `DpLanesInsufficient` | error | A display needs more lanes than the port's `dp_alt_max_lanes` |
| `UsbLimitedToUsb2` | warning | A display takes four lanes of the port |
| `DpLanesUnknown` | warning | A display is in a port whose `dp_alt_max_lanes` is `"unknown"` |

Diagnostics are ordered by socket path. An error stops Pass 4; a warning does not.

## Pass 4: effective throughput

Every Pass 4 diagnostic is a warning.

### Link rate

Pass 4 rates the link of each device whose `[interface]` protocol is `pcie`:

| Link property | Value |
| --- | --- |
| Generation | The smaller of the device's `generation` and the socket's |
| Lanes | The smaller of the device's `lanes` and the socket's |
| Rate | The per-lane data rate of the generation times the lanes, lowered to the tunnel cap if there is one |

A board socket has the smaller of its own `generation` and the generation of the root it descends from through `parent`, or the root's alone if it states none, and the lanes a mux allocates to it, or else its `max_lanes` (an `m2_slot`) or `max_electrical_lanes` (a `pcie_slot`). An adapter's `pcie_slot` has its own `generation` and `max_electrical_lanes`.

| Generation | Per-lane data rate (Gbps) |
| --- | --- |
| 1 | 2.5 × 8/10 |
| 2 | 5 × 8/10 |
| 3 | 8 × 128/130 |
| 4 | 16 × 128/130 |
| 5 | 32 × 128/130 |

A device requires the rate of its own `[interface]` link, computed the same way without a socket.

### IOMMU groups

The endpoints of an IOMMU group are the occupied board sockets and the controllers that carry its `iommu_group` number. A group is reported as shared when it has more than one endpoint and at least one of them is an occupied socket: under VFIO, a device in it can be passed through to a virtual machine only together with the others. Sockets inside an adapter belong to no group of the board.

### Diagnostics

| Diagnostic | Reported when |
| --- | --- |
| `Bottleneck` | A device's link rate is below the rate it requires |
| `UnratedLink` | The socket has no lane count, or the generation has no per-lane data rate |

| `SharedIommuGroup` | An IOMMU group is shared, listing its endpoints in id order |

Link diagnostics come first, ordered by socket path, followed by shared groups ordered by group number.

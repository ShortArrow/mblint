# Data schema

[日本語](schema.jp.md)

mblint reads three kinds of TOML file from a data root, the directory that contains `boards/`, `devices/` and `rigs/`. Every file carries `schema_version = "2.0.0"`.

Tables marked *strict* reject fields not listed for them. Elsewhere, unlisted fields are accepted and ignored.

## Boards

`boards/<vendor>/<model>.toml` describes a motherboard as a directed graph of nodes, with its BIOS at the default settings.

| Field | Contents |
| --- | --- |
| `vendor`, `model` | Strings naming the board |
| `source_manual` | Optional URL of the manual the values were read from |
| `source_page` | Optional page of that manual listing the board's expansion and storage |
| `nodes.<id>` | One node; its kind is given by `type` |

A node id contains no `.`. Every node except a root names its upstream node in `parent`.

### Roots

`type = "root"` is a provider that supplies a fixed number of lanes to the nodes under it.

| Field | Contents |
| --- | --- |
| `bus` | The bus it provides, such as `pcie` or `hsio` |
| `lanes` | Lanes supplied |
| `generation` | Link generation |

### Muxes

`type = "mux"` is a switch whose lane allocation depends on which sockets are occupied.

| Field | Contents |
| --- | --- |
| `parent` | The node it draws lanes from |
| `subtype` | `bifurcation` or `exclusive`. It describes the hardware and does not change how modes are evaluated |
| `modes` | The mux's modes, in order of precedence |

Every mode, whatever the subtype, has the same fields:

| Field | Contents |
| --- | --- |
| `when` | The condition under which the mode applies |
| `allocate` | Lanes each socket or bridge receives from the mux's parent, keyed by its id; empty if omitted |
| `disables` | Sockets that stop working while the mode applies; empty if omitted |

`when` is a strict table in one of two forms:

```toml
when = { socket = "PCI_E2", is = "occupied" }   # or "empty"
when = { socket = "M2_2", protocol = "pcie" }
```

A protocol condition holds only while the socket is occupied by a device running that protocol. The modes of a mux cover every state of the sockets it switches, empty included.

### Bridges

`type = "bridge"` is a protocol bridge, such as a USB4 host controller.

| Field | Contents |
| --- | --- |
| `parent` | The node it draws lanes from |
| `upstream_lanes` | Lanes it draws from a root parent |

A bridge whose parent is a mux draws the lanes the mux allocates to it.

### Controllers

`type = "controller"` is an onboard controller with an IOMMU group of its own, such as the SATA controller. It carries `iommu_group`. Its other fields are unspecified.

### Sockets

`type = "socket"` is a physical socket that devices are installed into. Its fields depend on its `category`:

| `category` | Strict | Fields |
| --- | --- | --- |
| `pcie_slot` | yes | `parent`, `slot_index`, `physical_form_factor`, `open_ended` (default `false`), `max_electrical_lanes`, `generation`, `iommu_group` |
| `m2_slot` | yes | `parent`, `key`, `supported_protocols`, `max_lanes`, `generation`, `iommu_group` |
| `sata_port` | yes | `parent`, `iommu_group` |
| `usb_c` | no | `parent`, `dp_alt_max_lanes` |
| `usb_a` | no | `parent` |

- `slot_index` is the slot's bracket position on the board, counted away from the CPU, the direction in which an ATX card's cooler extends.
- `physical_form_factor` is `x1`, `x4`, `x8` or `x16`.
- `open_ended` means the back of the slot is open, so that a wider card edge overhangs it.
- `max_electrical_lanes` is optional. It is the number of lanes wired to the slot, which may be fewer than its form factor holds.
- `generation` is optional. It is the PCIe generation of the socket's wiring, for a socket slower than its root.
- `key` is `B`, `E` or `M`.
- `dp_alt_max_lanes` is the number of DisplayPort Alt Mode lanes the port can drive. A port without it has no DP Alt Mode.
- `iommu_group` is optional. It is the group number observed on real hardware under `/sys/kernel/iommu_groups`.

## Protocols

A protocol is one of `pcie`, `sata`, `usb4`, `usb3_gen1x1` and `displayport`.

## Bandwidth

A bandwidth figure, in a field ending in `_gbps`, is in Gbps of data after line encoding and before protocol overhead. PCIe Gen3 x4, which signals at 8 GT/s per lane with 128b/130b encoding, is written as `31.5`; USB 3 Gen 1, which signals at 5 Gbps with 8b/10b encoding, as `4.0`.

## Devices

`devices/**/<id>.toml` describes one device.

| Field | Contents |
| --- | --- |
| `id`, `name` | Strings naming the device |
| `type` | `card`, `m2_module`, `adapter` or `display` |

### Cards and M.2 modules

A card or M.2 module declares what it speaks in `[interface]` and what it occupies in `[physical]`. Both tables are strict.

| Table | Fields |
| --- | --- |
| `[interface]` | `protocol`, `generation`, `lanes` (electrical lanes) |
| `[physical]` of a card | `edge` (`x1`, `x4`, `x8` or `x16`), `thickness_slots`, `length_mm` |
| `[physical]` of an M.2 module | `keys`, `form_factor` (such as `"2280"`) |

- `thickness_slots` counts the bracket positions the card covers, its own included, and is at least 1. A thickness between whole positions is rounded up, so a 3.5-slot card is written as `4`.
- `keys` lists the notches cut in the module, so a B+M module is written as `["B", "M"]`.

A card or M.2 module requires the bandwidth of its `[interface]` link.

### Adapters

An adapter is installed into a board socket and has sockets of its own.

| Table | Strict | Fields |
| --- | --- | --- |
| `[upstream]` | yes | `connector` (`type_c` or `type_a`), the `protocol` it runs towards the board, optional `max_gbps` |
| `[bridge]` | yes | `translates_to` (the protocol of its downstream side), optional `chipset`, `max_tunneling_gbps`, `sata_generation` |
| `[downstream_sockets.<NAME>]` | | `category` and the fields of that category; the adapter has no sockets if omitted |

A downstream socket of category `pcie_slot` is strict and has `physical_form_factor`, `open_ended` (default `false`), `max_electrical_lanes` and `generation`.

### Displays

A display has a strict `[display]` table and runs `displayport`.

| Field | Contents |
| --- | --- |
| `resolution` | String such as `"3840x2160"` |
| `refresh_rate` | Hz |
| `dsc_supported` | Whether it accepts Display Stream Compression |
| `required_dp_lanes` | DisplayPort lanes it needs for its resolution and refresh rate |
| `bandwidth_requirement_gbps` | Video data rate it needs |

## Rigs

`rigs/<name>.toml` describes one build.

| Field | Contents |
| --- | --- |
| `name` | String naming the rig |
| `board` | Path of the board file |
| `bindings` | Path of the device file installed in each socket, keyed by socket path |

File paths are relative to the data root, so a device file is named the same way from every rig.

A socket path is a board socket id, or `<adapter path>.<NAME>` for the socket `NAME` of the adapter installed at the adapter path. An adapter path may itself be dotted, so adapters nest to any depth.

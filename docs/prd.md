# Product Requirements Document: mblint (v2.0)

Points still undecided are listed in [open-issues.md](spec/open-issues.md).

## 1. Executive summary

`mblint` (display name `mb-lint`) is an open-source specification checker for building PCs, workstations and hypervisors with VFIO / PCI passthrough. It deterministically models and checks:

- physical slot interference,
- internal bus wiring and lane splitting (PCIe bifurcation, M.2 exclusivity),
- protocol translation and tunnelling (USB4 / TB4 eGPU, USB-to-SATA / NVMe bridges, DP Alt Mode),
- IOMMU group isolation boundaries.

Instead of writing rules per connector, mblint models the hardware on a board as a single directed graph of Root Providers, Muxes / Switches, Bridges and Sockets.

Hardware data is kept as declarative TOML under GitOps. The pure graph traversal and constraint resolution logic lives in a shared core library, `mblint-core`. From that one core, mblint serves both a fully static web wiring simulator for people and a fast CLI / MCP endpoint for LLM agents, without maintaining two implementations.

---

## 2. Problems to solve

1. **Connectors multiplex several electrical signals**
   * **An M.2 slot has many personalities**: depending on the card installed (PCIe NVMe, SATA SSD, OCuLink eGPU, Wi-Fi + BT), the bus it consumes (PCIe / SATA / USB) and what it disables (such as SATA ports) change.
   * **USB4 / TB4 tunnelling**: inside a 40 Gbps Type-C pipe, DisplayPort video (reserved first) and PCIe tunnelling (eGPU / NVMe) compete for bandwidth.
   * **Type-C DP Alt Mode**: driving uncompressed 4K / 60 Hz video forces USB traffic on the same port, or through a hub on it, down to USB 2.0 (480 Mbps).
2. **Collateral devices in virtualization and PCI passthrough (IOMMU / VFIO)**
   * A user who wants to pass only one USB controller or capture card to a virtual machine finds it grouped in the same IOMMU group as a PCIe switch or SATA controller under the PCH, and cannot isolate it.
3. **Physical, electrical and logical layers disagree, and it shows only after assembly**
   * A three-slot GPU covering the adjacent slot, an x16 card that does not fit a closed-ended x4 slot, a GPU or capture card running at half bandwidth in x8 mode.
4. **No machine-readable topology data**
   * Vendor catalogues and websites carry no graph structure, so AI agents and scripts cannot check a build deterministically.

---

## 3. Architecture and unified graph model

All hardware, whatever the protocol, is abstracted as a directed graph of the following node kinds.

```text
[Node: Root Provider] (CPU lanes, PCH HSIO, USB host, SATA host)
         │
         ▼
[Node: Mux / Switch]  (bifurcation IC, exclusive switch, PCIe packet switch)
         │
         ▼
[Node: Bridge]        (USB4 host, USB-to-SATA/NVMe bridge, DP Alt Mode mux)
         │
         ▼
[Node: Socket]        (PCIe slot, M.2 slot, Type-C, Type-A, SATA port)
         │
         ▼ (installed)
[Node: Device]        (GPU, NVMe SSD, eGPU box, display, USB hub)
```

Onboard controllers that have an IOMMU group of their own are nodes of kind `controller` ([ADR-0002](adr/0002-iommu-groups-declared-in-board.md)).

### System diagram

```text
               ┌──────────────────────────────┐
               │    Hardware specs (TOML)     │
               │  - boards/*.toml             │
               │  - devices/*.toml            │
               │  - rigs/*.toml               │
               └──────────────┬───────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │         mblint-core          │
               │  - AST parser (TOML/JSON)    │
               │  - Universal topology graph  │
               │  - 4-pass resolution engine  │
               │  - Evaluator & linter        │
               └───────┬──────────────┬───────┘
                       │              │
       (native crate)  │              │  (Wasm compilation)
                       ▼              ▼
 ┌───────────────────────────┐  ┌───────────────────────────┐
 │          mblint           │  │        mblint-web         │
 │       (native CLI)        │  │       (static SPA)        │
 │ - Rich human output       │  │ - Static SPA (Pages)      │
 │ - AI output (--json)      │  │ - Client-side Wasm solver │
 │ - MCP server (stdio)      │  │ - Topology & slot visual  │
 └───────────────────────────┘  └───────────────────────────┘
```

---

## 4. Data schema (TOML v2.0)

### 4.1 Board definition (`boards/<vendor>/<model>.toml`)

Mux conditions follow [ADR-0001](adr/0001-mux-mode-condition-as-structured-toml.md) and mux modes [ADR-0003](adr/0003-mux-modes-share-one-shape.md); IOMMU groups follow [ADR-0002](adr/0002-iommu-groups-declared-in-board.md).

```toml
schema_version = "2.0.0"
vendor = "MSI"
model = "MAG X870E TOMAHAWK WIFI"
source_manual = "https://download.msi.com/archive/mnu_exe/mb/MAGX870ETOMAHAWKWIFI.pdf"
source_page = 32

[form_factor]
standard = "ATX"
total_slot_indices = 7

# --- 1. Root providers ---
[nodes.root_cpu_peg]
type = "root"
domain = "CPU"
bus = "pcie"
lanes = 16
generation = 5

[nodes.root_cpu_gpp]
type = "root"
domain = "CPU"
bus = "pcie"
lanes = 4
generation = 4

[nodes.root_pch_hsio]
type = "root"
domain = "PCH"
bus = "hsio"
lanes = 12
generation = 4

# --- 2. Muxes / switches ---
[nodes.mux_peg_bifurcation]
type = "mux"
subtype = "bifurcation"
parent = "root_cpu_peg"

[[nodes.mux_peg_bifurcation.modes]]
when = { socket = "PCI_E2", is = "empty" }
allocate = { PCI_E1 = 16 }

[[nodes.mux_peg_bifurcation.modes]]
when = { socket = "PCI_E2", is = "occupied" }
allocate = { PCI_E1 = 8, PCI_E2 = 8 }

[nodes.mux_m2_sata_exclusive]
type = "mux"
subtype = "exclusive"
parent = "root_pch_hsio"

[[nodes.mux_m2_sata_exclusive.modes]]
when = { socket = "M2_2", is = "empty" }

[[nodes.mux_m2_sata_exclusive.modes]]
when = { socket = "M2_2", protocol = "pcie" }
allocate = { M2_2 = 4 }
disables = ["SATA_5", "SATA_6"]

[[nodes.mux_m2_sata_exclusive.modes]]
when = { socket = "M2_2", protocol = "sata" }

# --- 3. Protocol bridges ---
[nodes.bridge_asm4242_usb4]
type = "bridge"
parent = "root_cpu_gpp" # PCIe Gen4 x4
upstream_bus = "pcie"
upstream_lanes = 4
upstream_generation = 4
downstream_bus = "usb4"
max_throughput_gbps = 40.0

# --- 4. Physical sockets ---
[nodes.PCI_E1]
type = "socket"
category = "pcie_slot"
parent = "mux_peg_bifurcation"
slot_index = 2
physical_form_factor = "x16"
open_ended = false

[nodes.PCI_E2]
type = "socket"
category = "pcie_slot"
parent = "mux_peg_bifurcation"
slot_index = 4
physical_form_factor = "x16"
open_ended = false
iommu_group = 14

[nodes.M2_2]
type = "socket"
category = "m2_slot"
parent = "mux_m2_sata_exclusive"
key = "M"
supported_protocols = ["pcie", "sata"]
max_lanes = 4

[nodes.SATA_5]
type = "socket"
category = "sata_port"
parent = "root_pch_hsio"

[nodes.SATA_6]
type = "socket"
category = "sata_port"
parent = "root_pch_hsio"

[nodes.PORT_TYPEC_1]
type = "socket"
category = "usb_c"
parent = "bridge_asm4242_usb4"
supported_protocols = ["usb4", "usb3", "dp_alt_mode", "pcie_tunneling"]
dp_alt_max_lanes = 4
```

---

### 4.2 Device and adapter definitions (`devices/...`)

#### Example 1: eGPU box (USB4 / TB4 → PCIe bridge)

```toml
# devices/peripherals/razer_core_x.toml
schema_version = "2.0.0"
id = "razer_core_x"
name = "Razer Core X (eGPU Box)"
type = "adapter"

[upstream]
connector = "type_c"
protocol = "usb4"

[bridge]
chipset = "intel_jhl7440"
translates_to = "pcie"
max_tunneling_gbps = 32.0   # equivalent to PCIe Gen3 x4

[downstream_sockets.EGPU_SLOT]
category = "pcie_slot"
physical_form_factor = "x16"
max_electrical_lanes = 4
generation = 3
```

#### Example 2: USB 3 to SATA adapter

```toml
# devices/peripherals/usb_sata_adapter.toml
schema_version = "2.0.0"
id = "jms578_usb_sata"
name = "USB 3.0 to SATA Bridge Adapter"
type = "adapter"

[upstream]
connector = "type_a"
protocol = "usb3_gen1x1"
max_gbps = 5.0

[bridge]
translates_to = "sata"
sata_generation = 3       # SATA 6 Gbps
```

#### Example 3: 4K monitor (DP Alt Mode)

```toml
# devices/peripherals/u2723qe_monitor.toml
schema_version = "2.0.0"
id = "dell_u2723qe"
name = "Dell UltraSharp U2723QE"
type = "display"

[display]
resolution = "3840x2160"
refresh_rate = 60
dsc_supported = false
required_dp_lanes = 4      # requires all four lanes for video
bandwidth_requirement_gbps = 12.54
```

---

### 4.3 Rig instance (`rigs/<name>.toml`)

A rig supports **nested bindings**: a device installed into a socket of an adapter.

```toml
schema_version = "2.0.0"
name = "AI & Video Editing Rig with eGPU"
board = "boards/msi/mag_x870e_tomahawk_wifi.toml"

[bindings]
# Sockets on the board
PCI_E1 = "devices/cards/rtx_4090.toml"
M2_2   = "devices/ssds/crucial_t700.toml"

# eGPU box on the Type-C port
PORT_TYPEC_1 = "devices/peripherals/razer_core_x.toml"

# Secondary GPU in the eGPU box's internal slot (nested binding)
"PORT_TYPEC_1.EGPU_SLOT" = "devices/cards/rtx_3060.toml"
```

---

## 5. Resolution pipeline (`mblint-core`)

The engine runs four passes over the graph.

```text
[Input: board graph + devices + nested bindings]
              │
              ▼
  [Pass 1: physical layer]
  - Connector fit (an x16 card in an x4 slot, Type-C / M-key compatibility)
  - Overlap between cards on a discrete 3D grid (ATX slot positions 1-7, bracket, length, thickness)
              │ (proceed if passed)
              ▼
  [Pass 2: electrical exclusivity and mux resolution]
  - Exclusivity rules (a PCIe SSD in M2_2 disables the SATA_5/6 nodes)
  - Bifurcation (PCI_E2 occupied -> PCI_E1 drops from x16 to x8)
  - Lane balance of each root provider, including HSIO capacity
              │ (proceed if passed)
              ▼
  [Pass 3: tunnelling and protocol bridges]
  - Type-C Alt Mode allocation:
    - a monitor taking four lanes forces USB data down to USB 2.0 (480 Mbps)
  - USB4 / TB4 tunnelling bandwidth:
    - DP video is deducted from the 40 Gbps pipe first; the remainder goes to PCIe tunnelling (eGPU)
  - Bandwidth overcommit under a shared hub
              │ (proceed if passed)
              ▼
  [Pass 4: logical topology, effective throughput, IOMMU]
  - Effective transfer rate (GB/s) from the final link (generation, lanes, protocol)
  - Bottleneck warnings against each device's required bandwidth
  - IOMMU group boundaries: the devices that must be passed through together under VFIO
              │
              ▼
[Output: EvaluationResult (status, warnings, errors, topology graph, IOMMU groups)]
```

---

## 6. Component requirements

### 6.1 `mblint` (CLI)

1. **Check a rig (`mblint check <rig.toml>`)**
   * For people: PCIe / M.2 / USB state, effective bandwidth, fallback reasons and IOMMU groups as trees and tables.
   * For AI and scripts (`--json`):

     ```json
     {
       "status": "warning",
       "warnings": [
         {
           "code": "BANDWIDTH_TUNNELING_BOTTLENECK",
           "endpoint": "PORT_TYPEC_1.EGPU_SLOT",
           "device": "RTX 3060",
           "message": "Device operates at PCIe Gen3 x4 equivalent (approx 32 Gbps) limited by USB4 controller tunneling.",
           "theoretical_max_gbps": 64.0,
           "actual_gbps": 32.0
         },
         {
           "code": "VFIO_IOMMU_GROUP_SHARED",
           "group_id": 14,
           "endpoints": ["PCI_E2", "ONBOARD_SATA_CONTROLLER"],
           "message": "PCI_E2 shares IOMMU Group with Onboard SATA. Isolating this card for VM passthrough requires passing through or detaching SATA controller."
         }
       ]
     }
     ```

2. **Lint a board (`mblint lint <board.toml>`)**
   * Static analysis of a board graph alone: lane overcommit, cycles, unreachable sockets.
3. **MCP server (`mblint mcp`)**
   * MCP tools over stdio with which LLM clients (Cursor, Claude Desktop and others) explore topologies and diagnose builds.

### 6.2 `mblint-web`

1. **Fully static hosting**
   * No backend (GitHub Pages / Cloudflare Pages).
   * `mblint-core` runs locally in the browser as Wasm.
2. **Interactive topology visualizer**
   * Switches between the board layout (slots, I/O panel) and the bus wiring graph behind it.
   * Shows nested external devices such as eGPU boxes and USB hubs, and how bandwidth changes through them.
3. **Bring your own data**
   * Dropping a TOML file for a custom board or adapter onto the page checks it immediately.

---

## 7. Non-functional requirements

| Item | Requirement |
| --- | --- |
| **Unified architecture** | PCIe, SATA, M.2, USB and TB4 are handled by one graph traversal engine, not by separate per-protocol code paths. |
| **Performance** | The CLI evaluates a nested rig, including IOMMU groups, within 20 ms. Wasm evaluation on the web is reflected immediately. |
| **Portability** | The core and CLI run as a single binary on Linux, macOS and Windows. |
| **Determinism** | The same TOML input produces the same evaluation result on every OS and under Wasm. |
| **GitOps maintainability** | Board definitions are added and corrected through GitHub pull requests, and CI checks the lane conservation law (supply ≥ demand). |

---

## 8. Roadmap

* **Phase 1: unified graph engine and AST**
  * Directed graph model of Root, Mux, Bridge and Socket nodes
  * Four-pass pipeline (physical grid → mux exclusivity → bridges / tunnelling → IOMMU / throughput)
  * Unit tests on representative boards (X870E, Z790) and nested adapters (eGPU, USB-SATA)
* **Phase 2: CLI and MCP server**
  * `mblint` CLI (`check`, `lint`, `--json`)
  * MCP server (LLM integration over stdio)
* **Phase 3: web simulator (Wasm)**
  * Wasm bindings for `mblint-core`
  * Static SPA with the graph tree and slot wiring visualizer
* **Phase 4: GitOps and data**
  * GitHub Actions CI for pull requests
  * Definitions for major high-end boards and popular adapters and expansion cards

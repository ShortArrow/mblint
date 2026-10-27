# ADR-0008: Pass 3 caps tunnelled links, and Pass 4 rates PCIe links from generation and lanes

[日本語](0008-link-rates-and-tunnel-caps.jp.md)

- Status: Accepted

## Context

Pass 4 reports the rate a device actually gets and warns when it is below the rate the device requires, which is the rate of its own `[interface]` link. The rate a device gets depends on the socket it is in. Every socket in the PRD's board receives its lanes from a mux's `allocate`, but a board may wire an M.2 slot straight to a root, and such a slot has no allocation. A card inside an eGPU box is further limited by the box's `max_tunneling_gbps`, and the PRD puts tunnelling in Pass 3, which did not exist. Which Pass 2 diagnostics stop the passes after it was unspecified.

## Decision

- Every Pass 2 diagnostic is an error.
- Pass 3 computes, for each socket path inside an adapter, the tunnel cap: the smallest `max_tunneling_gbps` among the adapters that enclose it. A path with no such adapter has no cap. Pass 3 reports no diagnostics yet.
- Pass 4 rates the link of each device whose `[interface]` protocol is `pcie`:
  - The generation is the smaller of the device's and the socket's. A board socket has the generation of the root it descends from; an adapter's `pcie_slot` has its own `generation`.
  - The lane count is the smaller of the device's and the socket's. A board socket has the lanes a mux allocates to it, or else its `max_lanes`; an adapter's `pcie_slot` has its `max_electrical_lanes`.
  - The rate is the per-lane data rate of the generation times the lane count, lowered to the tunnel cap if there is one.
  - Per-lane data rates are defined for generations 1 to 5: 2.0 and 4.0 Gbps for generations 1 and 2 (8b/10b), and 8, 16 and 32 GT/s × 128/130 for generations 3 to 5.
- Pass 4 reports `Bottleneck` when the rate is below the device's required rate, and `UnratedLink` when a socket has no lane count or a generation has no defined rate. Pass 4 diagnostics are warnings.

## Rationale

- Taking the smaller of each side is how PCIe link training settles on a link.
- `max_lanes` is the only lane count an M.2 slot without a mux states.
- Computing the tunnel cap in Pass 3 keeps tunnelling where the PRD places it, and leaves room for display bandwidth to be deducted there.
- A warning for a slow link, not an error, matches the PRD's output example, where the bottleneck has status `warning`.

## Alternatives not taken

- Assuming a socket with no lane count runs at the device's width: a slot wired with fewer lanes would pass unnoticed.
- Capping tunnelled links inside Pass 4: Pass 3 would have nothing to do until displays are modelled, and the cap would move when they are.

## Consequences

Links of protocols other than PCIe, such as SATA, are not rated. Generation 6 links are reported as unrated until their data rate is defined.

# ADR-0007: Bandwidth is the data rate after line encoding, and a device requires the rate of its own link

[日本語](0007-bandwidth-after-line-encoding.jp.md)

- Status: Accepted

## Context

Passes 3 and 4 compare bandwidth figures with each other: a tunnel's capacity against the link behind it, a display's requirement against what is left of a Type-C pipe, a device's link against the link it actually gets. The PRD's figures were of two kinds. `bandwidth_requirement_gbps = 12.54` for a 4K / 60 Hz display is a data rate. `max_tunneling_gbps = 32.0` was described as PCIe Gen3 x4, which signals at 8 GT/s per lane with 128b/130b encoding and carries about 31.5 Gbps of data; `max_gbps = 5.0` for USB 3 Gen 1 was the signalling rate, of which 8b/10b encoding leaves 4 Gbps. The PRD gave the Pass 4 rate in GB/s and its output example in Gbps.

The PRD's Pass 4 warns "against each device's required bandwidth", but no device schema had a field for it. The output example reports a device's `theoretical_max_gbps` against its `actual_gbps`.

## Decision

- Every bandwidth figure, in data files and in output, is in Gbps (10⁹ bits per second) of data after line encoding and before protocol overhead such as packet headers and flow control.

  | Link | Signalling | Encoding | Written as |
  | --- | --- | --- | --- |
  | PCIe Gen3 x4 | 8 GT/s × 4 | 128b/130b | `31.5` |
  | USB 3 Gen 1 | 5 Gbps | 8b/10b | `4.0` |
  | USB4 Gen 3 x2 | 20 Gbps × 2 | 128b/132b | `38.8` |

- The engine derives the rate of a PCIe link from its generation and lane count, using the encoding of that generation.
- A card or an M.2 module requires the rate of its own `[interface]` link. Devices carry no separate field for required bandwidth.

## Rationale

- The display requirement is a data rate, so a capacity written the same way is compared with it directly.
- One unit for files and output means a figure in a warning can be checked against the file it came from.
- The output example already measures a device against the rate of its own link.

## Alternatives not taken

- Nominal figures as printed on data sheets: easier to copy, but they overstate the data a link carries, by 1.5 % with 128b/130b and by 25 % with 8b/10b, so a display could be judged to fit a pipe it does not.
- Nominal figures in files, converted by the engine: the engine would need the protocol and generation behind every figure to know its encoding, and `max_tunneling_gbps` carries neither.
- A required-bandwidth field on cards and modules: it would repeat `[interface]` for almost every device.

## Consequences

Whoever writes a data file converts a data-sheet figure to its data rate. The PRD's figures are restated: `32.0` to `31.5`, `5.0` to `4.0`, `40.0` to `38.8`.

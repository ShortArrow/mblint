# ADR-0009: Displays bind to Type-C ports and take DP Alt Mode lanes from them

[日本語](0009-displays-on-dp-alt-mode.jp.md)

- Status: Accepted

## Context

The PRD's Pass 3 checks DisplayPort Alt Mode on Type-C: a monitor that takes all four lanes leaves the port's USB data at USB 2.0. Its display example has `type = "display"` and a `[display]` table with `required_dp_lanes` and `bandwidth_requirement_gbps`, and its board's Type-C port has `dp_alt_max_lanes` and a `supported_protocols` list naming `dp_alt_mode`. No rule said which sockets a display fits, what protocol it runs for Pass 2, or which Pass 3 findings stop Pass 4. Docks, daisy chains and DisplayPort tunnelled through USB4 have no schema yet, and no adapter socket can take a display.

## Decision

- A display is a device of `type = "display"` with a strict `[display]` table: `resolution`, `refresh_rate`, `dsc_supported`, `required_dp_lanes` and `bandwidth_requirement_gbps`.
- A display fits a `usb_c` socket and runs the protocol `displayport`.
- A `usb_c` socket states the DP Alt Mode lanes it can drive in `dp_alt_max_lanes`; a port without it has no DP Alt Mode. `supported_protocols` on a `usb_c` socket stays unchecked.
- Pass 3 checks each display in a board `usb_c` socket:
  - `DpAltModeUnsupported`, an error, when the port has no DP Alt Mode.
  - `DpLanesInsufficient`, an error, when `required_dp_lanes` exceeds `dp_alt_max_lanes`.
  - `UsbLimitedToUsb2`, a warning, when the display takes four lanes, which leaves no lanes for USB 3 data on the port.
- A Pass 3 error stops Pass 4. Pass 3 warnings do not.

## Rationale

- `dp_alt_max_lanes` already carries the lane count the check needs, so the list of protocol names does not have to agree with it.
- A display that cannot get the lanes it needs shows no picture at its resolution, which is a build that does not work; a USB port slowed to USB 2.0 still works.
- Type-C is the only display-capable socket the schema has, so fitting only `usb_c` covers every case that can be written.

## Alternatives not taken

- Reading DP Alt Mode support from `supported_protocols`: the list's names, such as `usb3` and `pcie_tunneling`, are not protocols any device runs, and a port could list `dp_alt_mode` without a lane count.
- Checking `bandwidth_requirement_gbps` against the DP lanes now: the port's DisplayPort link rate (HBR2, HBR3, UHBR) has no field, so the comparison would rest on an assumed rate.

## Consequences

`bandwidth_requirement_gbps`, `resolution`, `refresh_rate` and `dsc_supported` are recorded but not yet evaluated. Deducting display bandwidth from a USB4 pipe waits for a schema of docks or daisy chains through which a display reaches a USB4 port.

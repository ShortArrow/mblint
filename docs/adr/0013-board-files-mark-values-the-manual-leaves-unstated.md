# ADR-0013: A board file marks a Type-C port's upstream and DP Alt Mode lanes as unknown when its manual does not state them

[日本語](0013-board-files-mark-values-the-manual-leaves-unstated.jp.md)

- Status: Accepted

## Context

Board files take every value from the vendor's manual and leave out what the manual does not state. Two gaps recur on the reference boards:

- The ASUS ProArt X870E-CREATOR WIFI and ROG STRIX Z890-F GAMING WIFI manuals list their USB4, Thunderbolt 4 and USB Type-C ports without saying which root, chipset or controller they draw lanes from. Every socket must name a `parent`, so those ports were left out, and no rig on either board could bind an adapter or a display to a Type-C port.
- The MSI MAG X870E TOMAHAWK WIFI and MAG Z890 TOMAHAWK WIFI manuals, and both ASUS manuals, say that a Type-C port outputs DisplayPort without giving its lane count. A port without `dp_alt_max_lanes` has no DP Alt Mode, so Pass 3 reported a display on such a port as `DpAltModeUnsupported`, an error that stops Pass 4.

No pass reads the `parent` of a `usb_c` or `usb_a` socket: Pass 2 charges lanes only through muxes and bridges, Pass 3 caps tunnels by the enclosing adapters, and Pass 4 rates only PCIe devices in PCIe and M.2 slots and in adapter sockets.

## Decision

- A `usb_c` or `usb_a` socket whose upstream the manual does not state has `parent = "unknown"`. No node has the id `unknown`.
- `dp_alt_max_lanes` takes either a lane count or `"unknown"`, the latter for a port that carries DP Alt Mode with no lane count stated. A port without the field still has no DP Alt Mode.
- Pass 3 reports a display on a port whose `dp_alt_max_lanes` is `"unknown"` as `DpLanesUnknown`, a warning, and checks nothing else about that display.
- These settle the open issue that a Type-C port carrying DisplayPort without a stated lane count was reported as unsupported.

## Rationale

- The physical fit of an adapter or display and the presence of DP Alt Mode can be checked without the port's upstream or lane count, so leaving the port out loses checks that do not depend on the missing value.
- An explicit `"unknown"` is a statement that the manual was read and is silent, which a forgotten field is not.
- A display whose lane needs cannot be compared with the port is not known to fail, so it is not an error; it is not known to work either, so it is reported.

## Alternatives not taken

- Making `parent` optional on Type-C and Type-A sockets: an omitted field cannot be told apart from one the author forgot.
- A separate flag such as `dp_alt_mode = true` beside `dp_alt_max_lanes`: two fields could contradict each other, as `dp_alt_mode = false` with a lane count would.
- Assuming four lanes, the most a Type-C connector carries: it would hide `DpLanesInsufficient` on a port that drives two.
- Describing the USB4 controller as a bridge with an unknown parent: a bridge draws `upstream_lanes` from its parent, which the manual does not give either, and the ports alone carry every value the passes read.

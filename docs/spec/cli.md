# Command line

[日本語](cli.jp.md)

The `mblint` binary evaluates rigs with the resolution passes and lints boards.

## `mblint check`

```sh
mblint check [--data-root <dir>] [--json] <rig>
```

| Argument | Contents |
| --- | --- |
| `<rig>` | Path of the rig file, relative to the data root, such as `rigs/workstation.toml` |
| `--data-root <dir>` | The data root; the current directory if omitted |
| `--json` | Print the report as JSON instead of text |

The rig, its board and its devices are all read from under the data root, by the paths the rig names.

### Exit status

| Status | Meaning |
| --- | --- |
| 0 | The rig was evaluated and no pass reported an error; warnings may have been reported |
| 1 | The rig was evaluated and a pass reported an error |
| 2 | The arguments are invalid, a file path breaks the rule for paths, or a file could not be read or does not conform to the schema |

When a file cannot be loaded, a message naming the file is printed to standard error and nothing is printed to standard output, with or without `--json`.

### Text output

Without `--json`, the report is printed for people: its status, every diagnostic with its message, the passes that did not run, and the link of each rated device. The layout of the text is unspecified; scripts read `--json`.

### JSON output

With `--json`, standard output is one JSON object:

| Field | Contents |
| --- | --- |
| `status` | `"error"` if any diagnostic is an error, else `"warning"` if any diagnostic is a warning, else `"ok"` |
| `passes` | `"ran"` or `"not_run"` for each of `physical` (Pass 1), `lanes` (Pass 2), `tunnels` (Pass 3) and `throughput` (Pass 4) |
| `diagnostics` | The diagnostics of every pass that ran, in pass order and, within a pass, in the order the pass specifies |
| `links` | The link of each device Pass 4 rated, keyed by socket path; empty if Pass 4 did not run |

A diagnostic is an object with these fields, followed by the fields of its code:

| Field | Contents |
| --- | --- |
| `pass` | The pass that reported it, named as in `passes` |
| `severity` | `"error"` or `"warning"`, as the pass specifies |
| `code` | The diagnostic's name in upper snake case |
| `message` | A sentence in English describing it. Its wording is not part of the output's contract |

| `code` | `pass` | Fields |
| --- | --- | --- |
| `UNKNOWN_SOCKET` | `physical` | `socket` |
| `WRONG_SOCKET_CATEGORY` | `physical` | `socket` |
| `EDGE_TOO_WIDE` | `physical` | `socket`, `edge`, `slot` (widths such as `"x16"`) |
| `KEY_MISMATCH` | `physical` | `socket`, `slot` (the slot's key, such as `"M"`) |
| `FORM_FACTOR_UNSUPPORTED` | `physical` | `socket`, `form_factor` (the module's, such as `"22110"`), `slot` (the slot's `supported_form_factors`) |
| `OBSTRUCTED` | `physical` | `socket`, `by` (the socket of the covering card) |
| `NO_MATCHING_MODE` | `lanes` | `mux` |
| `SOCKET_DISABLED` | `lanes` | `socket`, `mux` |
| `PROTOCOL_UNSUPPORTED` | `lanes` | `socket`, `protocol` (such as `"sata"`) |
| `LANE_OVERCOMMIT` | `lanes` | `root`, `supplied`, `demanded` |
| `DP_ALT_MODE_UNSUPPORTED` | `tunnels` | `socket` |
| `DP_LANES_INSUFFICIENT` | `tunnels` | `socket`, `required`, `available` |
| `USB_LIMITED_TO_USB2` | `tunnels` | `socket` |
| `DP_LANES_UNKNOWN` | `tunnels` | `socket` |
| `BOTTLENECK` | `throughput` | `socket`, `required_gbps`, `actual_gbps` |
| `UNRATED_LINK` | `throughput` | `socket` |
| `SHARED_IOMMU_GROUP` | `throughput` | `group`, `endpoints` |

A link is an object with `generation`, `lanes` and `gbps`. Bandwidth figures are unrounded.

## `mblint lint`

```sh
mblint lint [--data-root <dir>] [--json] <board>
```

| Argument | Contents |
| --- | --- |
| `<board>` | Path of the board file, relative to the data root, such as `boards/msi/mag_x870e_tomahawk_wifi.toml` |
| `--data-root <dir>` | The data root; the current directory if omitted |
| `--json` | Print the report as JSON instead of text |

The board is checked as [Board lint](lint.md) specifies. The exit status is that of `mblint check`, with "a pass reported an error" read as "lint reported an error", and a board that cannot be loaded is handled the same way.

Without `--json`, the report is printed for people: its status and every diagnostic with its message. The layout of the text is unspecified.

With `--json`, standard output is one JSON object with `status`, as for `mblint check`, and `diagnostics`, in the order lint specifies. A diagnostic is an object with `severity`, `code` and `message` as for `mblint check`, followed by the fields of its code:

| `code` | Fields |
| --- | --- |
| `INVALID_NODE_ID` | `node` |
| `UNKNOWN_PARENT` | `node`, `parent` |
| `INVALID_PARENT` | `node`, `parent` |
| `PARENT_CYCLE` | `nodes` |
| `UNKNOWN_MODE_TARGET` | `mux`, `node` |
| `FOREIGN_ALLOCATION` | `mux`, `node` |
| `UNREACHABLE_SOCKET` | `node` |
| `NO_MATCHING_MODE` | `mux`, `occupancy` |
| `LANE_OVERCOMMIT` | `root`, `supplied`, `demanded`, `occupancy` |

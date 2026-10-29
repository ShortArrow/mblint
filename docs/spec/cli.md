# Command line

[日本語](cli.jp.md)

The `mblint` binary evaluates rigs with the resolution passes.

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
| 2 | The arguments are invalid, or a file could not be read or does not conform to the schema |

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
| `OBSTRUCTED` | `physical` | `socket`, `by` (the socket of the covering card) |
| `NO_MATCHING_MODE` | `lanes` | `mux` |
| `SOCKET_DISABLED` | `lanes` | `socket`, `mux` |
| `LANE_OVERCOMMIT` | `lanes` | `root`, `supplied`, `demanded` |
| `DP_ALT_MODE_UNSUPPORTED` | `tunnels` | `socket` |
| `DP_LANES_INSUFFICIENT` | `tunnels` | `socket`, `required`, `available` |
| `USB_LIMITED_TO_USB2` | `tunnels` | `socket` |
| `DP_LANES_UNKNOWN` | `tunnels` | `socket` |
| `BOTTLENECK` | `throughput` | `socket`, `required_gbps`, `actual_gbps` |
| `UNRATED_LINK` | `throughput` | `socket` |
| `SHARED_IOMMU_GROUP` | `throughput` | `group`, `endpoints` |

A link is an object with `generation`, `lanes` and `gbps`. Bandwidth figures are unrounded.

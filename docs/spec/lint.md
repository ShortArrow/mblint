# Board lint

[日本語](lint.jp.md)

Lint checks a board file on its own, without a rig. A board that passes lint keeps the rules of [the data schema](schema.md) that parsing does not enforce, and no rig on it gets the Pass 2 diagnostic `NoMatchingMode` or `LaneOvercommit` described in [the resolution passes](passes.md).

## Structure

Every node's id and parent are checked, and so is every name in the modes of every mux.

- A node id contains no `.` and is not `unknown`.
- A `parent` names a root, a mux or a bridge. A `usb_c` or `usb_a` socket may instead have `parent = "unknown"`.
- Following `parent` from any node never returns to that node.
- In every mode, `when` and `disables` name sockets, and `allocate` names sockets and bridges whose parent is that mux.
- Every socket and bridge whose parent is a mux is allocated lanes by at least one of its modes.

A node whose upstream chain fails to reach a root is reported once, at the cause: the parent that names no node, the parent that cannot supply lanes, or the cycle.

## Occupancies

Lint runs Pass 2's mode selection and lane balance on every occupancy that the board's mux conditions tell apart. The sockets named in any `when` of the board are the condition sockets. Each condition socket takes these states, in this order:

1. empty;
2. occupied by a device running each protocol that a protocol condition on that socket names, in the order of [the protocols](schema.md#protocols);
3. occupied by a device running the first protocol, in that order, that no protocol condition on that socket names, if one exists.

Occupancies are ordered as numbers whose digits are the condition sockets in id order, the first socket most significant, each digit counting through its socket's states in the order above.

An occupancy is written as an object mapping each condition socket to `"empty"` or to the protocol of the device in it.

## Diagnostics

Every lint diagnostic is an error.

| Diagnostic | Reported when | Fields |
| --- | --- | --- |
| `InvalidNodeId` | A node id contains `.` or is `unknown` | `node` |
| `UnknownParent` | A `parent` names no node | `node`, `parent` |
| `InvalidParent` | A `parent` names a socket or a controller | `node`, `parent` |
| `ParentCycle` | Following `parent` returns to a node | `nodes`: the cycle, starting from its smallest id and in the order `parent` leads |
| `UnknownModeTarget` | A mode names a node that does not exist or is not of the kind its field requires | `mux`, `node` |
| `ForeignAllocation` | `allocate` names a socket or bridge whose parent is another node | `mux`, `node` |
| `UnreachableSocket` | A socket or bridge under a mux is allocated lanes by none of its modes | `node` |
| `NoMatchingMode` | Under some occupancy no mode of a mux holds | `mux`, `occupancy`: the first such occupancy |
| `LaneOvercommit` | Under some occupancy a root's demand exceeds its supply | `root`, `supplied`, `demanded`, `occupancy`: the occupancy of the greatest demand, the first of them on a tie |

Diagnostics are grouped by kind in the order of this table, each group ordered by its first field, then by its second. A mux or root is reported once, whatever the number of occupancies that fail it. A cycle is reported once.

# ADR-0016: Lint checks a board's structure, and Pass 2 under every occupancy its conditions tell apart

[日本語](0016-lint-checks-a-board-against-every-occupancy.jp.md)

- Status: Accepted

## Context

The PRD asks for `mblint lint <board.toml>`, a static analysis of a board alone for lane overcommit, cycles and unreachable sockets. The schema already states rules that parsing does not enforce: node ids contain no `.` and none is `unknown`, every node but a root names its upstream, and the modes of a mux cover every state of the sockets it switches. Pass 2 selects mux modes and balances root lanes for one occupancy, the rig's. A mux condition names one socket and tests whether it is empty, occupied, or occupied by a device running a given protocol. The reference boards name at most four condition sockets each.

## Decision

- `mblint lint [--data-root <dir>] [--json] <board>` reads the board by the rule for paths and exits as `mblint check` does.
- Lint checks node ids, parents, cycles and the names in mux modes, and reports a socket or bridge under a mux that none of its modes allocates.
- Lint runs Pass 2 under every occupancy the board's conditions tell apart, and reports a mux for which some occupancy matches no mode and a root that some occupancy overcommits, each with an occupancy that shows it.
- An unreachable chain is reported at its cause; `UnreachableSocket` names a node that a mux never allocates.
- Every lint diagnostic is an error.

## Rationale

- Running Pass 2 itself makes the guarantee exact: a board that passes lint gives no rig `NoMatchingMode` or `LaneOvercommit`, and one that fails has a rig that gets it.
- Conditions distinguish only empty, the protocols they name and any other protocol, so one state per class is enough, and the count stays near 2 to the number of condition sockets.
- A node that fails to reach a root does so because of a missing or unsuitable parent or a cycle; reporting the cause once avoids one diagnostic per descendant.
- Each witness occupancy lets a board author reproduce the failure with `mblint check`.

## Alternatives not taken

- Adding up each mux's largest mode: muxes whose modes depend on the same socket can never all take their largest mode at once, so it reports boards that no rig overcommits.
- Counting the lanes of sockets directly under a root: Pass 2 does not charge them, and lint would then disagree with `mblint check`. It is left as an open issue.
- Capping the number of occupancies: no board described so far comes near a size where the count matters.
- Running lint as part of `mblint check`: a board's author runs lint, a rig's author runs check.

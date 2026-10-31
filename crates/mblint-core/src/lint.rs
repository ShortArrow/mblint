//! Lint: checks a board on its own, as `docs/spec/lint.md` specifies.

use std::collections::{BTreeMap, BTreeSet};

use serde::Serialize;

use crate::board::{Board, Condition, Mux, Node, Socket};
use crate::lanes::{self, resolve_lanes};
use crate::occupancy::Occupancy;
use crate::protocol::Protocol;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(tag = "code", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Diagnostic {
    /// The node id contains `.` or is `unknown`.
    InvalidNodeId { node: String },
    /// `parent` names no node.
    UnknownParent { node: String, parent: String },
    /// `parent` names a socket or a controller, which supply no lanes.
    InvalidParent { node: String, parent: String },
    /// The cycle, from its smallest id in the order `parent` leads.
    ParentCycle { nodes: Vec<String> },
    /// A mode of `mux` names a node that is missing or not of the kind its field requires.
    UnknownModeTarget { mux: String, node: String },
    /// `allocate` of `mux` names a socket or bridge whose parent is another node.
    ForeignAllocation { mux: String, node: String },
    /// A socket or bridge under a mux that none of the mux's modes allocates.
    UnreachableSocket { node: String },
    /// No mode of `mux` holds under `occupancy`, the first such occupancy.
    NoMatchingMode {
        mux: String,
        occupancy: BTreeMap<String, Occupant>,
    },
    /// `root` is overcommitted; `occupancy` is the first occupancy of the greatest demand.
    LaneOvercommit {
        root: String,
        supplied: u32,
        demanded: u32,
        occupancy: BTreeMap<String, Occupant>,
    },
}

/// The state of a condition socket in an occupancy, serialized as `"empty"` or the protocol.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "snake_case")]
pub enum Occupant {
    Empty,
    #[serde(untagged)]
    Running(Protocol),
}

/// Every lint diagnostic of `board`, grouped by kind in the specification's order.
pub fn lint(board: &Board) -> Vec<Diagnostic> {
    let mut diagnostics = invalid_ids(board);
    diagnostics.extend(parents(board));
    diagnostics.extend(cycles(board));
    diagnostics.extend(mode_targets(board));
    diagnostics.extend(unreachable(board));
    diagnostics.extend(occupancies(board));
    diagnostics
}

fn invalid_ids(board: &Board) -> Vec<Diagnostic> {
    board
        .nodes
        .keys()
        .filter(|id| id.contains('.') || *id == "unknown")
        .map(|id| Diagnostic::InvalidNodeId { node: id.clone() })
        .collect()
}

/// `UnknownParent` diagnostics, then `InvalidParent` ones.
fn parents(board: &Board) -> Vec<Diagnostic> {
    let mut unknown = Vec::new();
    let mut invalid = Vec::new();
    for (id, node) in &board.nodes {
        let Some(parent) = node.parent() else {
            continue;
        };
        let may_be_unknown = matches!(node, Node::Socket(Socket::UsbC(_) | Socket::UsbA(_)));
        match board.nodes.get(parent) {
            None if may_be_unknown && parent == "unknown" => {}
            None => unknown.push(Diagnostic::UnknownParent {
                node: id.clone(),
                parent: parent.to_string(),
            }),
            Some(Node::Socket(_) | Node::Controller(_)) => {
                invalid.push(Diagnostic::InvalidParent {
                    node: id.clone(),
                    parent: parent.to_string(),
                })
            }
            Some(_) => {}
        }
    }
    unknown.extend(invalid);
    unknown
}

fn cycles(board: &Board) -> Vec<Diagnostic> {
    let mut found: BTreeSet<Vec<String>> = BTreeSet::new();
    for start in board.nodes.keys() {
        let mut path: Vec<&str> = vec![start];
        while let Some(parent) = board
            .nodes
            .get(*path.last().expect("path is never empty"))
            .and_then(Node::parent)
            .filter(|parent| board.nodes.contains_key(*parent))
        {
            if let Some(at) = path.iter().position(|id| *id == parent) {
                found.insert(from_smallest(&path[at..]));
                break;
            }
            path.push(parent);
        }
    }
    found
        .into_iter()
        .map(|nodes| Diagnostic::ParentCycle { nodes })
        .collect()
}

/// The cycle rotated to start at its smallest id.
fn from_smallest(cycle: &[&str]) -> Vec<String> {
    let start = (0..cycle.len())
        .min_by_key(|&i| cycle[i])
        .expect("a cycle has a node");
    cycle[start..]
        .iter()
        .chain(&cycle[..start])
        .map(|id| id.to_string())
        .collect()
}

fn muxes(board: &Board) -> impl Iterator<Item = (&String, &Mux)> {
    board.nodes.iter().filter_map(|(id, node)| match node {
        Node::Mux(mux) => Some((id, mux)),
        _ => None,
    })
}

fn condition_socket(condition: &Condition) -> &str {
    match condition {
        Condition::State(condition) => &condition.socket,
        Condition::Protocol(condition) => &condition.socket,
    }
}

/// `UnknownModeTarget` diagnostics, then `ForeignAllocation` ones.
fn mode_targets(board: &Board) -> Vec<Diagnostic> {
    let mut unknown: BTreeSet<(&str, &str)> = BTreeSet::new();
    let mut foreign: BTreeSet<(&str, &str)> = BTreeSet::new();
    for (id, mux) in muxes(board) {
        for mode in &mux.modes {
            let switched = std::iter::once(condition_socket(&mode.when))
                .chain(mode.disables.iter().map(String::as_str));
            for socket in switched {
                if !matches!(board.nodes.get(socket), Some(Node::Socket(_))) {
                    unknown.insert((id, socket));
                }
            }
            for target in mode.allocate.keys() {
                match board.nodes.get(target) {
                    Some(node @ (Node::Socket(_) | Node::Bridge(_))) => {
                        if node.parent() != Some(id.as_str()) {
                            foreign.insert((id, target));
                        }
                    }
                    _ => {
                        unknown.insert((id, target));
                    }
                }
            }
        }
    }
    let unknown = unknown
        .into_iter()
        .map(|(mux, node)| Diagnostic::UnknownModeTarget {
            mux: mux.to_string(),
            node: node.to_string(),
        });
    let foreign = foreign
        .into_iter()
        .map(|(mux, node)| Diagnostic::ForeignAllocation {
            mux: mux.to_string(),
            node: node.to_string(),
        });
    unknown.chain(foreign).collect()
}

fn unreachable(board: &Board) -> Vec<Diagnostic> {
    board
        .nodes
        .iter()
        .filter(|(_, node)| matches!(node, Node::Socket(_) | Node::Bridge(_)))
        .filter(|(id, node)| {
            let parent = node.parent().and_then(|parent| board.nodes.get(parent));
            match parent {
                Some(Node::Mux(mux)) => !mux.modes.iter().any(|m| m.allocate.contains_key(*id)),
                _ => false,
            }
        })
        .map(|(id, _)| Diagnostic::UnreachableSocket { node: id.clone() })
        .collect()
}

/// The states each condition socket takes, keyed by socket id, in the specification's order.
fn condition_states(board: &Board) -> BTreeMap<&str, Vec<Occupant>> {
    let mut named: BTreeMap<&str, BTreeSet<Protocol>> = BTreeMap::new();
    for (_, mux) in muxes(board) {
        for mode in &mux.modes {
            let protocols = named.entry(condition_socket(&mode.when)).or_default();
            if let Condition::Protocol(condition) = &mode.when {
                protocols.insert(condition.protocol);
            }
        }
    }
    named
        .into_iter()
        .map(|(socket, protocols)| {
            let other = Protocol::ALL.into_iter().find(|p| !protocols.contains(p));
            let states = std::iter::once(Occupant::Empty)
                .chain(protocols.into_iter().map(Occupant::Running))
                .chain(other.map(Occupant::Running))
                .collect();
            (socket, states)
        })
        .collect()
}

/// `NoMatchingMode` diagnostics, then `LaneOvercommit` ones, from Pass 2 run under every
/// occupancy the board's conditions tell apart.
fn occupancies(board: &Board) -> Vec<Diagnostic> {
    let states = condition_states(board);
    let sockets: Vec<&str> = states.keys().copied().collect();
    let mut digits = vec![0; sockets.len()];
    let mut unmatched: BTreeMap<String, BTreeMap<String, Occupant>> = BTreeMap::new();
    let mut overcommitted: BTreeMap<String, (u32, u32, BTreeMap<String, Occupant>)> =
        BTreeMap::new();

    loop {
        let witness: BTreeMap<String, Occupant> = sockets
            .iter()
            .zip(&digits)
            .map(|(socket, &digit)| (socket.to_string(), states[socket][digit]))
            .collect();
        for diagnostic in resolve_lanes(board, &occupancy(&witness)).diagnostics {
            match diagnostic {
                lanes::Diagnostic::NoMatchingMode { mux } => {
                    unmatched.entry(mux).or_insert_with(|| witness.clone());
                }
                lanes::Diagnostic::LaneOvercommit {
                    root,
                    supplied,
                    demanded,
                } => {
                    let greatest = overcommitted.get(&root).map_or(0, |(_, d, _)| *d);
                    if demanded > greatest {
                        overcommitted.insert(root, (supplied, demanded, witness.clone()));
                    }
                }
                lanes::Diagnostic::SocketDisabled { .. } => {}
            }
        }
        if !advance(&mut digits, &sockets, &states) {
            break;
        }
    }

    let unmatched = unmatched
        .into_iter()
        .map(|(mux, occupancy)| Diagnostic::NoMatchingMode { mux, occupancy });
    let overcommitted = overcommitted
        .into_iter()
        .map(
            |(root, (supplied, demanded, occupancy))| Diagnostic::LaneOvercommit {
                root,
                supplied,
                demanded,
                occupancy,
            },
        );
    unmatched.chain(overcommitted).collect()
}

/// Steps `digits` to the next occupancy, the last socket least significant; `false` after the last.
fn advance(digits: &mut [usize], sockets: &[&str], states: &BTreeMap<&str, Vec<Occupant>>) -> bool {
    for (digit, socket) in digits.iter_mut().zip(sockets).rev() {
        *digit += 1;
        if *digit < states[socket].len() {
            return true;
        }
        *digit = 0;
    }
    false
}

fn occupancy(witness: &BTreeMap<String, Occupant>) -> Occupancy {
    let mut occupancy = Occupancy::default();
    for (socket, occupant) in witness {
        if let Occupant::Running(protocol) = occupant {
            occupancy.install(socket.clone(), *protocol);
        }
    }
    occupancy
}

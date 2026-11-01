//! Pass 2: mux mode selection, disabled sockets and root lane balance.

use std::collections::{BTreeMap, BTreeSet};

use serde::Serialize;

use crate::board::{Board, Node, Socket};
use crate::occupancy::Occupancy;

/// Lanes allocated to each socket, the sockets switched off, and the problems found.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaneResolution {
    /// Lanes a selected mux mode allocates, keyed by socket or bridge id.
    pub allocations: BTreeMap<String, u32>,
    /// Sockets disabled by a selected mux mode, whether or not a device is installed in them.
    pub disabled: BTreeSet<String>,
    /// Lanes the children of each root demand, keyed by root id.
    pub demanded: BTreeMap<String, u32>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(rename = "LanesDiagnostic"))]
#[serde(tag = "code", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Diagnostic {
    /// The lanes demanded by a root's children exceed what the root supplies.
    LaneOvercommit {
        root: String,
        supplied: u32,
        demanded: u32,
    },
    /// No mode of the mux holds for the given occupancy; the mux allocates nothing.
    NoMatchingMode { mux: String },
    /// A device is installed in a socket that the selected mode of `mux` disables.
    SocketDisabled { socket: String, mux: String },
}

/// Selects a mode for every mux, then reports devices in disabled sockets and roots that
/// supply fewer lanes than demanded.
///
/// A mux demands the sum of its selected mode's allocations and a bridge its upstream lanes,
/// both charged to their direct parent. A PCIe or M.2 slot whose parent is a root demands its
/// stated lanes from it, occupied or not, unless a selected mode disables it. Diagnostics are grouped by kind in the order
/// `NoMatchingMode`, `SocketDisabled`, `LaneOvercommit`, each ordered by node id.
pub fn resolve_lanes(board: &Board, occupancy: &Occupancy) -> LaneResolution {
    let mut allocations = BTreeMap::new();
    let mut disabled_by: BTreeMap<String, &str> = BTreeMap::new();
    let mut demand: BTreeMap<&str, u32> = BTreeMap::new();
    let mut diagnostics = Vec::new();

    for (id, node) in &board.nodes {
        match node {
            Node::Mux(mux) => match mux.select_mode(occupancy) {
                Some(mode) => {
                    allocations.extend(mode.allocate.clone());
                    *demand.entry(&mux.parent).or_default() += mode.allocate.values().sum::<u32>();
                    for socket in &mode.disables {
                        disabled_by.entry(socket.clone()).or_insert(id);
                    }
                }
                None => diagnostics.push(Diagnostic::NoMatchingMode { mux: id.clone() }),
            },
            Node::Bridge(bridge) => {
                *demand.entry(&bridge.parent).or_default() += bridge.upstream_lanes;
            }
            Node::Root(_) | Node::Socket(_) | Node::Controller(_) => {}
        }
    }

    for (id, node) in &board.nodes {
        if let Node::Socket(socket) = node
            && !disabled_by.contains_key(id)
            && matches!(board.nodes.get(socket.parent()), Some(Node::Root(_)))
        {
            *demand.entry(socket.parent()).or_default() += wired_lanes(socket);
        }
    }

    for (socket, mux) in &disabled_by {
        if occupancy.is_occupied(socket) {
            diagnostics.push(Diagnostic::SocketDisabled {
                socket: socket.clone(),
                mux: mux.to_string(),
            });
        }
    }

    let mut demanded_by_root = BTreeMap::new();
    for (id, node) in &board.nodes {
        if let Node::Root(root) = node {
            let demanded = demand.get(id.as_str()).copied().unwrap_or(0);
            demanded_by_root.insert(id.clone(), demanded);
            if demanded > root.lanes {
                diagnostics.push(Diagnostic::LaneOvercommit {
                    root: id.clone(),
                    supplied: root.lanes,
                    demanded,
                });
            }
        }
    }

    LaneResolution {
        allocations,
        disabled: disabled_by.into_keys().collect(),
        demanded: demanded_by_root,
        diagnostics,
    }
}

/// Lanes wired to a PCIe or M.2 slot, or 0 for another socket or a slot that states none.
fn wired_lanes(socket: &Socket) -> u32 {
    match socket {
        Socket::PcieSlot(slot) => slot.max_electrical_lanes,
        Socket::M2Slot(slot) => slot.max_lanes,
        Socket::SataPort(_) | Socket::UsbC(_) | Socket::UsbA(_) => None,
    }
    .map_or(0, u32::from)
}

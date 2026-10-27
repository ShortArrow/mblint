//! Pass 2: mux mode selection and root lane balance.

use std::collections::BTreeMap;

use crate::board::{Board, Node};
use crate::occupancy::Occupancy;

/// Lanes allocated to each socket, and the problems found while allocating them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaneResolution {
    pub allocations: BTreeMap<String, u32>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Diagnostic {
    /// The lanes demanded by a root's children exceed what the root supplies.
    LaneOvercommit {
        root: String,
        supplied: u32,
        demanded: u32,
    },
    /// No mode of the mux holds for the given occupancy; the mux allocates nothing.
    NoMatchingMode { mux: String },
}

/// Selects a mode for every mux and checks that no root supplies fewer lanes than demanded.
///
/// A mux demands the sum of its selected mode's allocations and a bridge its upstream lanes,
/// both charged to their direct parent. Diagnostics are ordered by node id within each kind,
/// mode selection first.
pub fn resolve_lanes(board: &Board, occupancy: &Occupancy) -> LaneResolution {
    let mut allocations = BTreeMap::new();
    let mut demand: BTreeMap<&str, u32> = BTreeMap::new();
    let mut diagnostics = Vec::new();

    for (id, node) in &board.nodes {
        match node {
            Node::Mux(mux) => match mux.select_mode(occupancy) {
                Some(mode) => {
                    allocations.extend(mode.allocate.clone());
                    *demand.entry(&mux.parent).or_default() += mode.allocate.values().sum::<u32>();
                }
                None => diagnostics.push(Diagnostic::NoMatchingMode { mux: id.clone() }),
            },
            Node::Bridge(bridge) => {
                *demand.entry(&bridge.parent).or_default() += bridge.upstream_lanes;
            }
            Node::Root(_) | Node::Socket(_) => {}
        }
    }

    for (id, node) in &board.nodes {
        if let Node::Root(root) = node {
            let demanded = demand.get(id.as_str()).copied().unwrap_or(0);
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
        diagnostics,
    }
}

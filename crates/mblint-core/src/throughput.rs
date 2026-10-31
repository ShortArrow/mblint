//! Pass 4: the rate each PCIe device's link runs at, against the rate the device requires.

use std::collections::BTreeMap;

use serde::Serialize;

use crate::board::{Board, Node, Socket};
use crate::device::{Device, DeviceKind, DownstreamSocket, Interface};
use crate::lanes::LaneResolution;
use crate::protocol::Protocol;
use crate::tunnels::Tunnelling;

/// The link of each rated device, and the warnings about them.
#[derive(Debug, Clone, PartialEq)]
pub struct Throughput {
    /// Keyed by socket path.
    pub links: BTreeMap<String, Link>,
    pub diagnostics: Vec<Diagnostic>,
}

/// The link a device settles on in its socket.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct Link {
    pub generation: u8,
    pub lanes: u32,
    /// Data rate after line encoding, lowered to the tunnel cap if there is one.
    pub gbps: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(rename = "ThroughputDiagnostic"))]
#[serde(tag = "code", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Diagnostic {
    /// The device's link runs below the rate of its own interface.
    Bottleneck {
        socket: String,
        required_gbps: f64,
        actual_gbps: f64,
    },
    /// The socket states no lane count, or a generation involved has no defined data rate.
    UnratedLink { socket: String },
}

/// Rates the link of every installed device whose interface runs PCIe.
///
/// Each side contributes a generation and a lane count, and the link takes the smaller of each.
/// Diagnostics are ordered by socket path.
pub fn rate_links(
    board: &Board,
    installed: &BTreeMap<String, Device>,
    lanes: &LaneResolution,
    tunnels: &Tunnelling,
) -> Throughput {
    let mut links = BTreeMap::new();
    let mut diagnostics = Vec::new();

    for (path, device) in installed {
        let Some(interface) = pcie_interface(device) else {
            continue;
        };
        let rated = socket_capacity(board, installed, lanes, path).and_then(|socket| {
            let required = rate(interface.generation, u32::from(interface.lanes))?;
            let link = settle(interface, socket, tunnels.caps.get(path).copied())?;
            Some((link, required))
        });
        match rated {
            Some((link, required_gbps)) => {
                if link.gbps < required_gbps {
                    diagnostics.push(Diagnostic::Bottleneck {
                        socket: path.clone(),
                        required_gbps,
                        actual_gbps: link.gbps,
                    });
                }
                links.insert(path.clone(), link);
            }
            None => diagnostics.push(Diagnostic::UnratedLink {
                socket: path.clone(),
            }),
        }
    }

    Throughput { links, diagnostics }
}

/// The generation and lane count a socket offers.
#[derive(Debug, Clone, Copy)]
struct Capacity {
    generation: u8,
    lanes: u32,
}

fn pcie_interface(device: &Device) -> Option<&Interface> {
    match &device.kind {
        DeviceKind::Card { interface, .. } | DeviceKind::M2Module { interface, .. }
            if interface.protocol == Protocol::Pcie =>
        {
            Some(interface)
        }
        _ => None,
    }
}

fn settle(interface: &Interface, socket: Capacity, cap: Option<f64>) -> Option<Link> {
    let generation = interface.generation.min(socket.generation);
    let lanes = u32::from(interface.lanes).min(socket.lanes);
    let uncapped = rate(generation, lanes)?;
    Some(Link {
        generation,
        lanes,
        gbps: cap.map_or(uncapped, |cap| uncapped.min(cap)),
    })
}

/// The capacity of the socket at `path`; `None` if it states no lane count or generation.
///
/// A board socket has the smaller of its own `generation` and its root's, and the lanes a mux
/// allocates to it, or else its `max_lanes` or `max_electrical_lanes`. A socket inside an adapter
/// states both itself.
fn socket_capacity(
    board: &Board,
    installed: &BTreeMap<String, Device>,
    lanes: &LaneResolution,
    path: &str,
) -> Option<Capacity> {
    match path.rsplit_once('.') {
        Some((adapter_path, name)) => {
            let DeviceKind::Adapter {
                downstream_sockets, ..
            } = &installed.get(adapter_path)?.kind
            else {
                return None;
            };
            let DownstreamSocket::PcieSlot(slot) = downstream_sockets.get(name)?;
            Some(Capacity {
                generation: slot.generation,
                lanes: u32::from(slot.max_electrical_lanes),
            })
        }
        None => {
            let socket = board.socket(path)?;
            let allocated = lanes.allocations.get(path).copied();
            let max_lanes = match socket {
                Socket::M2Slot(slot) => slot.max_lanes.map(u32::from),
                Socket::PcieSlot(slot) => slot.max_electrical_lanes.map(u32::from),
                _ => None,
            };
            let root = root_generation(board, path)?;
            Some(Capacity {
                generation: socket.generation().map_or(root, |own| own.min(root)),
                lanes: allocated.or(max_lanes)?,
            })
        }
    }
}

/// The generation of the root that `id` descends from; `None` if no root is reached.
fn root_generation(board: &Board, id: &str) -> Option<u8> {
    let mut id = id;
    for _ in 0..=board.nodes.len() {
        match board.nodes.get(id)? {
            Node::Root(root) => return Some(root.generation),
            node => id = node.parent()?,
        }
    }
    None
}

/// The data rate of a PCIe link after line encoding; `None` for a generation with no defined rate.
fn rate(generation: u8, lanes: u32) -> Option<f64> {
    let (transfers, payload, encoded) = match generation {
        1 => (2.5, 8.0, 10.0),
        2 => (5.0, 8.0, 10.0),
        3 => (8.0, 128.0, 130.0),
        4 => (16.0, 128.0, 130.0),
        5 => (32.0, 128.0, 130.0),
        _ => return None,
    };
    Some(transfers * payload / encoded * f64::from(lanes))
}

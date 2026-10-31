//! The board of a rig as the web page draws it, as `docs/spec/web.md` specifies.

use std::collections::BTreeMap;

use serde::Serialize;

use crate::board::{Node, Socket, SocketCategory};
use crate::evaluate::occupancy;
use crate::lanes::{LaneResolution, resolve_lanes};
use crate::protocol::Protocol;
use crate::rig::LoadedRig;
use crate::throughput::socket_capacity;

/// One node of the board, with what the installed devices make of it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export))]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum LayoutNode {
    Root {
        parent: Option<String>,
        generation: u8,
        supplied: u32,
        /// Lanes its children demand, counted as Pass 2 counts them.
        demanded: u32,
    },
    Mux {
        parent: Option<String>,
        /// Position from 0 of the selected mode; `None` when no mode holds.
        mode: Option<usize>,
    },
    Bridge {
        parent: Option<String>,
        /// Upstream lanes it demands of its parent.
        lanes: u32,
    },
    Controller {
        parent: Option<String>,
    },
    Socket {
        parent: Option<String>,
        category: SocketCategory,
        slot_index: Option<u8>,
        /// Path of the device file the rig installs in it.
        device: Option<String>,
        disabled: bool,
        /// What the socket offers, as Pass 4 rates a link; `None` when it states no lane count.
        offers: Option<LinkWidth>,
        /// The installed device's PCIe link; `None` when empty or not PCIe.
        needs: Option<LinkWidth>,
    },
}

/// A PCIe generation and lane count.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct LinkWidth {
    pub generation: u8,
    pub lanes: u32,
}

/// Every node of the rig's board, keyed by node id, whether or not a pass reports an error.
pub fn layout(rig: &LoadedRig) -> BTreeMap<String, LayoutNode> {
    let occupancy = occupancy(rig);
    let lanes = resolve_lanes(&rig.board, &occupancy);
    rig.board
        .nodes
        .iter()
        .map(|(id, node)| {
            let parent = node.parent().map(str::to_string);
            let laid_out = match node {
                Node::Root(root) => LayoutNode::Root {
                    parent,
                    generation: root.generation,
                    supplied: root.lanes,
                    demanded: lanes.demanded.get(id).copied().unwrap_or(0),
                },
                Node::Mux(mux) => LayoutNode::Mux {
                    parent,
                    mode: mux.selected_position(&occupancy),
                },
                Node::Bridge(bridge) => LayoutNode::Bridge {
                    parent,
                    lanes: bridge.upstream_lanes,
                },
                Node::Controller(_) => LayoutNode::Controller { parent },
                Node::Socket(socket) => socket_node(rig, &lanes, id, socket, parent),
            };
            (id.clone(), laid_out)
        })
        .collect()
}

fn socket_node(
    rig: &LoadedRig,
    lanes: &LaneResolution,
    id: &str,
    socket: &Socket,
    parent: Option<String>,
) -> LayoutNode {
    let slot_index = match socket {
        Socket::PcieSlot(slot) => Some(slot.slot_index),
        _ => None,
    };
    let needs = rig
        .installed
        .get(id)
        .and_then(|device| device.interface())
        .filter(|interface| interface.protocol == Protocol::Pcie)
        .map(|interface| LinkWidth {
            generation: interface.generation,
            lanes: u32::from(interface.lanes),
        });
    let offers = socket_capacity(&rig.board, &rig.installed, lanes, id).map(|capacity| LinkWidth {
        generation: capacity.generation,
        lanes: capacity.lanes,
    });
    LayoutNode::Socket {
        parent,
        category: socket.category(),
        slot_index,
        device: rig.rig.bindings.get(id).cloned(),
        disabled: lanes.disabled.contains(id),
        offers,
        needs,
    }
}

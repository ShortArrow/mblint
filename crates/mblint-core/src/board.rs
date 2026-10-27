//! Board definition: a directed graph of roots, muxes, bridges and sockets.

use std::collections::BTreeMap;

use serde::Deserialize;

use crate::connector::{M2Key, PcieWidth};
use crate::occupancy::Occupancy;
use crate::parse::ParseError;
use crate::protocol::Protocol;

/// A motherboard as declared in `boards/<vendor>/<model>.toml`.
///
/// Nodes are keyed by their id, which contains no `.`; every non-root node names its upstream
/// node in `parent`.
#[derive(Debug, Clone, Deserialize)]
pub struct Board {
    pub schema_version: String,
    pub vendor: String,
    pub model: String,
    pub nodes: BTreeMap<String, Node>,
}

impl Board {
    /// Parses a board definition, rejecting values outside the schema's enumerations.
    pub fn from_toml(source: &str) -> Result<Self, ParseError> {
        toml::from_str(source).map_err(ParseError::from_toml)
    }

    /// The socket with id `id`; `None` if no node has that id or the node is not a socket.
    pub fn socket(&self, id: &str) -> Option<&Socket> {
        match self.nodes.get(id) {
            Some(Node::Socket(socket)) => Some(socket),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Node {
    Root(Root),
    Mux(Mux),
    Bridge(Bridge),
    Socket(Socket),
    Controller(Controller),
}

impl Node {
    /// The upstream node's id; `None` for a root or a controller.
    pub fn parent(&self) -> Option<&str> {
        match self {
            Node::Root(_) | Node::Controller(_) => None,
            Node::Mux(mux) => Some(&mux.parent),
            Node::Bridge(bridge) => Some(&bridge.parent),
            Node::Socket(socket) => Some(socket.parent()),
        }
    }
}

/// A resource provider that supplies a fixed number of lanes to its children.
#[derive(Debug, Clone, Deserialize)]
pub struct Root {
    pub bus: String,
    pub lanes: u32,
    pub generation: u8,
}

/// A switch whose lane allocation depends on which sockets are occupied.
///
/// Every subtype is evaluated the same way; `subtype` only describes the hardware.
#[derive(Debug, Clone, Deserialize)]
pub struct Mux {
    pub parent: String,
    pub subtype: MuxSubtype,
    pub modes: Vec<Mode>,
}

impl Mux {
    /// The first mode, in declaration order, whose condition holds; `None` if no mode applies.
    pub fn select_mode(&self, occupancy: &Occupancy) -> Option<&Mode> {
        self.modes.iter().find(|mode| mode.when.holds(occupancy))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MuxSubtype {
    Bifurcation,
    Exclusive,
}

/// One configuration of a mux, applied while `when` holds.
#[derive(Debug, Clone, Deserialize)]
pub struct Mode {
    pub when: Condition,
    /// Lanes each socket or bridge receives from the mux's parent, keyed by its id.
    #[serde(default)]
    pub allocate: BTreeMap<String, u32>,
    /// Sockets that stop working while this mode applies.
    #[serde(default)]
    pub disables: Vec<String>,
}

/// A test on one socket: either its occupancy or the protocol of the device in it.
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum Condition {
    State(StateCondition),
    Protocol(ProtocolCondition),
}

impl Condition {
    pub fn holds(&self, occupancy: &Occupancy) -> bool {
        match self {
            Condition::State(condition) => {
                let is_occupied = occupancy.is_occupied(&condition.socket);
                match condition.is {
                    SocketState::Empty => !is_occupied,
                    SocketState::Occupied => is_occupied,
                }
            }
            Condition::Protocol(condition) => {
                occupancy.protocol(&condition.socket) == Some(condition.protocol)
            }
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StateCondition {
    pub socket: String,
    pub is: SocketState,
}

/// Holds only while the socket is occupied by a device running `protocol`.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProtocolCondition {
    pub socket: String,
    pub protocol: Protocol,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SocketState {
    Empty,
    Occupied,
}

/// A protocol bridge. Under a root it consumes `upstream_lanes`; under a mux it receives the
/// lanes the selected mode allocates to it.
#[derive(Debug, Clone, Deserialize)]
pub struct Bridge {
    pub parent: String,
    pub upstream_lanes: u32,
}

/// An onboard controller with an IOMMU group of its own. Other fields are accepted unchecked.
#[derive(Debug, Clone, Deserialize)]
pub struct Controller {
    pub iommu_group: u32,
}

/// A physical socket that devices are installed into, with the attributes of its category.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "category", rename_all = "snake_case")]
pub enum Socket {
    PcieSlot(PcieSlot),
    M2Slot(M2Slot),
    SataPort(SataPort),
    UsbC(UsbC),
    UsbA(UsbA),
}

impl Socket {
    /// The IOMMU group observed for the socket; `None` if not declared or not declarable.
    pub fn iommu_group(&self) -> Option<u32> {
        match self {
            Socket::PcieSlot(slot) => slot.iommu_group,
            Socket::M2Slot(slot) => slot.iommu_group,
            Socket::SataPort(port) => port.iommu_group,
            Socket::UsbC(_) | Socket::UsbA(_) => None,
        }
    }

    pub fn parent(&self) -> &str {
        match self {
            Socket::PcieSlot(slot) => &slot.parent,
            Socket::M2Slot(slot) => &slot.parent,
            Socket::SataPort(port) => &port.parent,
            Socket::UsbC(port) => &port.parent,
            Socket::UsbA(port) => &port.parent,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PcieSlot {
    pub parent: String,
    /// Bracket position on the board, counted away from the CPU.
    pub slot_index: u8,
    pub physical_form_factor: PcieWidth,
    /// Whether the back of the slot is open, so that a wider card edge overhangs it.
    #[serde(default)]
    pub open_ended: bool,
    pub iommu_group: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct M2Slot {
    pub parent: String,
    pub key: M2Key,
    #[serde(default)]
    pub supported_protocols: Vec<Protocol>,
    pub max_lanes: Option<u8>,
    pub iommu_group: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SataPort {
    pub parent: String,
    pub iommu_group: Option<u32>,
}

/// A Type-C port. Attributes not listed here, such as `supported_protocols`, are accepted unchecked.
#[derive(Debug, Clone, Deserialize)]
pub struct UsbC {
    pub parent: String,
    /// DisplayPort Alt Mode lanes the port can drive; `None` if it has no DP Alt Mode.
    pub dp_alt_max_lanes: Option<u8>,
}

/// A Type-A port. Attributes other than `parent` are accepted unchecked.
#[derive(Debug, Clone, Deserialize)]
pub struct UsbA {
    pub parent: String,
}

//! Board definition: a directed graph of roots, muxes, bridges and sockets.

use std::collections::BTreeMap;
use std::fmt;

use serde::Deserialize;

use crate::occupancy::Occupancy;
use crate::protocol::Protocol;

/// A motherboard as declared in `boards/<vendor>/<model>.toml`.
///
/// Nodes are keyed by their id; every non-root node names its upstream node in `parent`.
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
        toml::from_str(source).map_err(ParseError)
    }
}

/// A board definition that does not conform to the schema.
#[derive(Debug)]
pub struct ParseError(toml::de::Error);

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl std::error::Error for ParseError {}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Node {
    Root(Root),
    Mux(Mux),
    Bridge(Bridge),
    Socket(Socket),
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
    /// Lanes each socket receives from the mux's parent.
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

/// A protocol bridge that consumes `upstream_lanes` from its parent.
#[derive(Debug, Clone, Deserialize)]
pub struct Bridge {
    pub parent: String,
    pub upstream_lanes: u32,
}

/// A physical socket that devices are installed into.
#[derive(Debug, Clone, Deserialize)]
pub struct Socket {
    pub category: String,
    pub parent: String,
}

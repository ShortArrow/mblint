//! Board definition: a directed graph of roots, muxes, bridges and sockets.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use serde::Deserialize;

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
#[derive(Debug, Clone, Deserialize)]
pub struct Mux {
    pub parent: String,
    #[serde(flatten)]
    pub kind: MuxKind,
}

impl Mux {
    /// The first mode, in declaration order, whose condition holds; `None` if no mode applies.
    pub fn select_mode(&self, occupied: &BTreeSet<String>) -> Option<&Mode> {
        match &self.kind {
            MuxKind::Bifurcation { modes } => modes.iter().find(|mode| mode.when.holds(occupied)),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "subtype", rename_all = "snake_case")]
pub enum MuxKind {
    Bifurcation { modes: Vec<Mode> },
}

/// One configuration of a mux: the lanes each socket receives while `when` holds.
#[derive(Debug, Clone, Deserialize)]
pub struct Mode {
    pub when: Condition,
    pub allocate: BTreeMap<String, u32>,
}

/// The occupancy of one socket.
#[derive(Debug, Clone, Deserialize)]
pub struct Condition {
    pub socket: String,
    pub is: SocketState,
}

impl Condition {
    pub fn holds(&self, occupied: &BTreeSet<String>) -> bool {
        let is_occupied = occupied.contains(&self.socket);
        match self.is {
            SocketState::Empty => !is_occupied,
            SocketState::Occupied => is_occupied,
        }
    }
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

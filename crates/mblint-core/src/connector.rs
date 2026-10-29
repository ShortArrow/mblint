//! Connector shapes shared by board sockets and devices.

use serde::{Deserialize, Serialize};

/// The width of a PCIe slot or card edge. Variants are ordered from narrowest to widest.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PcieWidth {
    X1,
    X4,
    X8,
    X16,
}

/// The plug an adapter uses towards the board.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UpstreamConnector {
    TypeC,
    TypeA,
}

/// The key of an M.2 slot, or one of the notches cut in an M.2 module.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize)]
pub enum M2Key {
    B,
    E,
    M,
}

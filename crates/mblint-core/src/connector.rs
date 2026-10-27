//! Connector shapes shared by board sockets and devices.

use serde::Deserialize;

/// The width of a PCIe slot or card edge. Variants are ordered from narrowest to widest.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PcieWidth {
    X1,
    X4,
    X8,
    X16,
}

/// The key of an M.2 slot, or one of the notches cut in an M.2 module.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize)]
pub enum M2Key {
    B,
    E,
    M,
}

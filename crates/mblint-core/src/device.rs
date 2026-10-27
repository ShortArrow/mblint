//! Device definitions: what a device speaks and what it physically occupies.

use std::num::NonZeroU8;

use serde::Deserialize;

use crate::connector::{M2Key, PcieWidth};
use crate::parse::ParseError;
use crate::protocol::Protocol;

/// A device as declared in `devices/**/<id>.toml`.
#[derive(Debug, Clone, Deserialize)]
pub struct Device {
    pub schema_version: String,
    pub id: String,
    pub name: String,
    #[serde(flatten)]
    pub kind: DeviceKind,
}

impl Device {
    pub fn from_toml(source: &str) -> Result<Self, ParseError> {
        toml::from_str(source).map_err(ParseError::from_toml)
    }

    pub fn interface(&self) -> &Interface {
        match &self.kind {
            DeviceKind::Card { interface, .. } | DeviceKind::M2Module { interface, .. } => {
                interface
            }
        }
    }

    pub fn protocol(&self) -> Protocol {
        self.interface().protocol
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DeviceKind {
    Card {
        interface: Interface,
        physical: CardShape,
    },
    M2Module {
        interface: Interface,
        physical: M2ModuleShape,
    },
}

/// The link a device runs: protocol, generation and electrical lane count.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Interface {
    pub protocol: Protocol,
    pub generation: u8,
    pub lanes: u8,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CardShape {
    pub edge: PcieWidth,
    /// Bracket positions the card covers, its own included.
    pub thickness_slots: NonZeroU8,
    pub length_mm: u16,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct M2ModuleShape {
    /// Notches cut in the module; it fits any slot whose key is listed.
    pub keys: Vec<M2Key>,
    pub form_factor: String,
}

//! Device definitions: what a device speaks and what it physically occupies.

use std::collections::BTreeMap;
use std::num::NonZeroU8;

use serde::{Deserialize, Serialize};

use crate::board::SocketCategory;
use crate::connector::{M2Key, PcieWidth, UpstreamConnector};
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

    /// The protocol the device runs towards the socket it is installed in.
    pub fn protocol(&self) -> Protocol {
        match &self.kind {
            DeviceKind::Card { interface, .. } | DeviceKind::M2Module { interface, .. } => {
                interface.protocol
            }
            DeviceKind::Adapter { upstream, .. } => upstream.protocol,
            DeviceKind::Display { .. } => Protocol::Displayport,
        }
    }

    /// The `type` the device is declared with.
    pub fn device_type(&self) -> DeviceType {
        match &self.kind {
            DeviceKind::Card { .. } => DeviceType::Card,
            DeviceKind::M2Module { .. } => DeviceType::M2Module,
            DeviceKind::Adapter { .. } => DeviceType::Adapter,
            DeviceKind::Display { .. } => DeviceType::Display,
        }
    }

    /// The device's own link; `None` for an adapter or a display, which declare none.
    pub fn interface(&self) -> Option<&Interface> {
        match &self.kind {
            DeviceKind::Card { interface, .. } | DeviceKind::M2Module { interface, .. } => {
                Some(interface)
            }
            DeviceKind::Adapter { .. } | DeviceKind::Display { .. } => None,
        }
    }

    /// The category of board socket the device is installed in.
    pub fn socket_category(&self) -> SocketCategory {
        match &self.kind {
            DeviceKind::Card { .. } => SocketCategory::PcieSlot,
            DeviceKind::M2Module { .. } => SocketCategory::M2Slot,
            DeviceKind::Display { .. } => SocketCategory::UsbC,
            DeviceKind::Adapter { upstream, .. } => match upstream.connector {
                UpstreamConnector::TypeC => SocketCategory::UsbC,
                UpstreamConnector::TypeA => SocketCategory::UsbA,
            },
        }
    }
}

/// The `type` of a device file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "snake_case")]
pub enum DeviceType {
    Card,
    M2Module,
    Adapter,
    Display,
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
    /// A device installed into a board socket that exposes sockets of its own.
    Adapter {
        upstream: Upstream,
        bridge: Bridge,
        /// Sockets inside the adapter, keyed by the name a rig appends to the adapter's path.
        #[serde(default)]
        downstream_sockets: BTreeMap<String, DownstreamSocket>,
    },
    /// A monitor driven over DisplayPort Alt Mode.
    Display { display: DisplaySpec },
}

/// The link a device runs: protocol, generation and electrical lane count.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
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

/// The side of an adapter that plugs into the board.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Upstream {
    pub connector: UpstreamConnector,
    pub protocol: Protocol,
    pub max_gbps: Option<f64>,
}

/// The protocol translation inside an adapter.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Bridge {
    /// The protocol of the adapter's downstream side.
    pub translates_to: Protocol,
    pub chipset: Option<String>,
    pub max_tunneling_gbps: Option<f64>,
    pub sata_generation: Option<u8>,
}

/// A socket inside an adapter, with the attributes of its category.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "category", rename_all = "snake_case")]
pub enum DownstreamSocket {
    PcieSlot(AdapterPcieSlot),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AdapterPcieSlot {
    pub physical_form_factor: PcieWidth,
    #[serde(default)]
    pub open_ended: bool,
    pub max_electrical_lanes: u8,
    pub generation: u8,
}

/// What a display needs to show its resolution at its refresh rate.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DisplaySpec {
    pub resolution: String,
    pub refresh_rate: u16,
    pub dsc_supported: bool,
    pub required_dp_lanes: u8,
    pub bandwidth_requirement_gbps: f64,
}

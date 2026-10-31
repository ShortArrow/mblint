//! What each data file is, decided by its contents, as `docs/spec/web.md` specifies.

use std::collections::BTreeMap;

use serde::Serialize;

use crate::board::{Board, SocketCategory};
use crate::device::{Device, DeviceType, Interface};
use crate::rig::Rig;

/// What one file is.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, rename = "CatalogEntry"))]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Entry {
    Board {
        vendor: String,
        model: String,
    },
    Device {
        name: String,
        #[serde(rename = "type")]
        device_type: DeviceType,
        interface: Option<Interface>,
        socket_category: SocketCategory,
    },
    Rig {
        name: String,
        board: String,
    },
    /// Says why the file is not a board, why not a device and why not a rig.
    Invalid {
        message: String,
    },
}

/// The entry of every file in `files`, keyed by its path.
pub fn catalog(files: &BTreeMap<String, String>) -> BTreeMap<String, Entry> {
    files
        .iter()
        .map(|(path, source)| (path.clone(), entry(source)))
        .collect()
}

/// A board if `source` parses as one, else a device, else a rig, else invalid.
fn entry(source: &str) -> Entry {
    let board = match Board::from_toml(source) {
        Ok(board) => {
            return Entry::Board {
                vendor: board.vendor,
                model: board.model,
            };
        }
        Err(error) => error,
    };
    let device = match Device::from_toml(source) {
        Ok(device) => {
            return Entry::Device {
                device_type: device.device_type(),
                interface: device.interface().cloned(),
                socket_category: device.socket_category(),
                name: device.name,
            };
        }
        Err(error) => error,
    };
    match Rig::from_toml(source) {
        Ok(rig) => Entry::Rig {
            name: rig.name,
            board: rig.board,
        },
        Err(rig) => Entry::Invalid {
            message: format!("not a board: {board}; not a device: {device}; not a rig: {rig}"),
        },
    }
}

//! Rig definitions and loading them, with the board and devices they name, through a reader.

use std::collections::BTreeMap;

use serde::Deserialize;

use crate::board::Board;
use crate::device::Device;
use crate::parse::ParseError;

/// A build as declared in `rigs/<name>.toml`. Paths are relative to the data root.
#[derive(Debug, Clone, Deserialize)]
pub struct Rig {
    pub schema_version: String,
    pub name: String,
    pub board: String,
    /// Device file installed in each socket, keyed by socket path: a board socket id, or
    /// `<adapter path>.<socket name>` for a socket inside an adapter.
    #[serde(default)]
    pub bindings: BTreeMap<String, String>,
}

impl Rig {
    pub fn from_toml(source: &str) -> Result<Self, ParseError> {
        toml::from_str(source).map_err(ParseError::from_toml)
    }
}

/// A rig with its board and every bound device parsed.
#[derive(Debug, Clone)]
pub struct LoadedRig {
    pub rig: Rig,
    pub board: Board,
    /// Installed devices keyed by socket path.
    pub installed: BTreeMap<String, Device>,
}

#[derive(Debug)]
pub enum LoadError {
    /// The reader could not supply the file at `path`.
    Read { path: String, message: String },
    /// The file at `path` does not conform to the schema.
    Parse { path: String, error: ParseError },
}

/// Reads the rig at `path`, then its board and bound devices, through `read`.
///
/// `read` maps a data-root-relative path to the file's contents, or to a message saying why it
/// cannot. Bindings are loaded in socket path order and the first failure is returned.
pub fn load_rig(
    path: &str,
    read: impl Fn(&str) -> Result<String, String>,
) -> Result<LoadedRig, LoadError> {
    let rig = parse_file(path, &read, Rig::from_toml)?;
    let board = parse_file(&rig.board, &read, Board::from_toml)?;

    let mut installed = BTreeMap::new();
    for (socket, device_path) in &rig.bindings {
        let device = parse_file(device_path, &read, Device::from_toml)?;
        installed.insert(socket.clone(), device);
    }

    Ok(LoadedRig {
        rig,
        board,
        installed,
    })
}

fn parse_file<T>(
    path: &str,
    read: &impl Fn(&str) -> Result<String, String>,
    parse: impl Fn(&str) -> Result<T, ParseError>,
) -> Result<T, LoadError> {
    let source = read(path).map_err(|message| LoadError::Read {
        path: path.to_string(),
        message,
    })?;
    parse(&source).map_err(|error| LoadError::Parse {
        path: path.to_string(),
        error,
    })
}

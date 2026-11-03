//! Rig definitions and loading them, with the board and devices they name, through a reader.

use std::collections::BTreeMap;
use std::fmt;

use serde::Deserialize;
use toml_edit::{DocumentMut, Item, Value};

use crate::board::Board;
use crate::device::Device;
use crate::parse::ParseError;

/// A build as declared in `rigs/<name>.toml`. Paths are relative to the data root.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "schemars", derive(schemars::JsonSchema))]
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

/// `source`, a rig file, with `board` and `bindings` in place of the rig's, changing only the
/// values that differ and keeping the rest of the text, its comments, order and layout included.
pub fn rebind(
    source: &str,
    board: &str,
    bindings: &BTreeMap<String, String>,
) -> Result<String, ParseError> {
    Rig::from_toml(source)?;
    let mut document: DocumentMut = source
        .parse()
        .expect("a text that parses as a rig parses as a TOML document");
    set_string(&mut document["board"], board);
    if !document.contains_key("bindings") {
        document["bindings"] = toml_edit::table();
    }
    let table = document["bindings"]
        .as_table_like_mut()
        .expect("a rig's bindings are a table");
    let gone: Vec<String> = table
        .iter()
        .map(|(socket, _)| socket.to_string())
        .filter(|socket| !bindings.contains_key(socket))
        .collect();
    let mut reshaped = !gone.is_empty();
    for socket in gone {
        table.remove(&socket);
    }
    for (socket, device) in bindings {
        match table.get_mut(socket) {
            Some(item) => set_string(item, device),
            None => {
                table.insert(socket, Item::Value(Value::from(device.as_str())));
                reshaped = true;
            }
        }
    }
    if let Some(inline) = document["bindings"].as_inline_table_mut()
        && reshaped
    {
        inline.fmt();
    }
    Ok(document.to_string())
}

/// Puts the string `text` in `item` unless it already holds it, keeping the comments around it.
fn set_string(item: &mut Item, text: &str) {
    if item.as_str() == Some(text) {
        return;
    }
    let mut value = Value::from(text);
    if let Some(old) = item.as_value() {
        *value.decor_mut() = old.decor().clone();
    }
    *item = Item::Value(value);
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
    /// `path` breaks the rule for paths in `docs/spec/schema.md`, so it was not read.
    InvalidPath { path: String },
    /// The reader could not supply the file at `path`.
    Read { path: String, message: String },
    /// The file at `path` does not conform to the schema.
    Parse { path: String, error: ParseError },
}

/// Names the file that failed, then why.
impl fmt::Display for LoadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LoadError::InvalidPath { path } => {
                write!(f, "{path}: not a path of names under the data root")
            }
            LoadError::Read { path, message } => write!(f, "{path}: {message}"),
            LoadError::Parse { path, error } => write!(f, "{path}: {error}"),
        }
    }
}

impl std::error::Error for LoadError {}

/// Reads the board at `path` through `read`, as [`load_rig`] reads a rig's board.
pub fn load_board(
    path: &str,
    read: impl Fn(&str) -> Result<String, String>,
) -> Result<Board, LoadError> {
    parse_file(path, &read, Board::from_toml)
}

/// Reads the rig at `path`, then its board and bound devices, through `read`.
///
/// `read` maps a data-root-relative path to the file's contents, or to a message saying why it
/// cannot. `read` is only given paths that stay under the data root. Bindings are loaded in
/// socket path order and the first failure is returned.
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
    if !stays_under_data_root(path) {
        return Err(LoadError::InvalidPath {
            path: path.to_string(),
        });
    }
    let source = read(path).map_err(|message| LoadError::Read {
        path: path.to_string(),
        message,
    })?;
    parse(&source).map_err(|error| LoadError::Parse {
        path: path.to_string(),
        error,
    })
}

/// Whether `path` is names separated by `/`, none empty, `.` or `..`, and none holding `\` or
/// `:`, so that it can be neither absolute nor a drive on any platform.
fn stays_under_data_root(path: &str) -> bool {
    path.split('/')
        .all(|name| !matches!(name, "" | "." | "..") && !name.contains(['\\', ':']))
}

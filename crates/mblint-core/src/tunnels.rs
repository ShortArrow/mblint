//! Pass 3: bandwidth limits that adapters place on the sockets inside them, and the DP Alt Mode
//! lanes displays take from Type-C ports.

use std::collections::BTreeMap;

use crate::board::{Board, DpAltLanes, Socket};
use crate::device::{Device, DeviceKind, DisplaySpec};

/// DP Alt Mode lanes a Type-C connector carries; a display taking all of them leaves none for
/// USB 3 data.
const TYPE_C_DP_LANES: u8 = 4;

/// The tunnel cap of each installed socket path inside an adapter that limits tunnelling, and
/// the problems found with displays.
#[derive(Debug, Clone, PartialEq)]
pub struct Tunnelling {
    /// Gbps after line encoding, keyed by socket path.
    pub caps: BTreeMap<String, f64>,
    /// Ordered by socket path.
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Diagnostic {
    /// A display is in a Type-C port without DP Alt Mode.
    DpAltModeUnsupported { socket: String },
    /// A display needs more DP Alt Mode lanes than the port drives.
    DpLanesInsufficient {
        socket: String,
        required: u8,
        available: u8,
    },
    /// A display takes every lane of the port, so USB data on it runs at USB 2.0.
    UsbLimitedToUsb2 { socket: String },
    /// A display is in a port whose DP Alt Mode lane count is unknown, so whether it gets its
    /// lanes is not known.
    DpLanesUnknown { socket: String },
}

impl Diagnostic {
    /// Whether the diagnostic stops the passes after Pass 3.
    pub fn is_error(&self) -> bool {
        !matches!(
            self,
            Diagnostic::UsbLimitedToUsb2 { .. } | Diagnostic::DpLanesUnknown { .. }
        )
    }
}

/// Caps each installed path at the smallest `max_tunneling_gbps` of the adapters enclosing it,
/// and checks each display in a board Type-C port against the port's DP Alt Mode lanes.
pub fn resolve_tunnels(board: &Board, installed: &BTreeMap<String, Device>) -> Tunnelling {
    let caps = installed
        .keys()
        .filter_map(|path| {
            enclosing_limits(installed, path)
                .reduce(f64::min)
                .map(|cap| (path.clone(), cap))
        })
        .collect();
    let diagnostics = installed
        .iter()
        .filter_map(|(path, device)| match (&device.kind, board.socket(path)) {
            (DeviceKind::Display { display }, Some(Socket::UsbC(port))) => {
                dp_alt_mode(path, display, port.dp_alt_max_lanes)
            }
            _ => None,
        })
        .collect();
    Tunnelling { caps, diagnostics }
}

/// The `max_tunneling_gbps` of each installed adapter whose path is a proper prefix of `path`.
fn enclosing_limits<'a>(
    installed: &'a BTreeMap<String, Device>,
    path: &'a str,
) -> impl Iterator<Item = f64> + 'a {
    path.match_indices('.')
        .filter_map(|(end, _)| installed.get(&path[..end]))
        .filter_map(|device| match &device.kind {
            DeviceKind::Adapter { bridge, .. } => bridge.max_tunneling_gbps,
            _ => None,
        })
}

fn dp_alt_mode(
    socket: &str,
    display: &DisplaySpec,
    port_lanes: Option<DpAltLanes>,
) -> Option<Diagnostic> {
    let socket = socket.to_string();
    let available = match port_lanes {
        None => return Some(Diagnostic::DpAltModeUnsupported { socket }),
        Some(DpAltLanes::Unknown(_)) => return Some(Diagnostic::DpLanesUnknown { socket }),
        Some(DpAltLanes::Count(available)) => available,
    };
    let required = display.required_dp_lanes;
    if required > available {
        Some(Diagnostic::DpLanesInsufficient {
            socket,
            required,
            available,
        })
    } else if required == TYPE_C_DP_LANES {
        Some(Diagnostic::UsbLimitedToUsb2 { socket })
    } else {
        None
    }
}

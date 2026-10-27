//! Pass 3: bandwidth limits that adapters place on the sockets inside them.

use std::collections::BTreeMap;

use crate::device::{Device, DeviceKind};

/// The tunnel cap of each installed socket path inside an adapter that limits tunnelling.
#[derive(Debug, Clone, PartialEq)]
pub struct Tunnelling {
    /// Gbps after line encoding, keyed by socket path.
    pub caps: BTreeMap<String, f64>,
}

/// Caps each installed path at the smallest `max_tunneling_gbps` of the adapters enclosing it.
pub fn resolve_tunnels(installed: &BTreeMap<String, Device>) -> Tunnelling {
    let caps = installed
        .keys()
        .filter_map(|path| {
            enclosing_limits(installed, path)
                .reduce(f64::min)
                .map(|cap| (path.clone(), cap))
        })
        .collect();
    Tunnelling { caps }
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

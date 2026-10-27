//! Which sockets have a device installed, and the protocol each device runs.

use std::collections::BTreeMap;

use crate::protocol::Protocol;

/// The devices installed in a rig, keyed by socket id. A socket holds at most one device.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Occupancy {
    installed: BTreeMap<String, Protocol>,
}

impl Occupancy {
    /// Records a device running `protocol` in `socket`, replacing any device already there.
    pub fn install(&mut self, socket: impl Into<String>, protocol: Protocol) {
        self.installed.insert(socket.into(), protocol);
    }

    pub fn is_occupied(&self, socket: &str) -> bool {
        self.installed.contains_key(socket)
    }

    /// The protocol of the device in `socket`; `None` if the socket is empty.
    pub fn protocol(&self, socket: &str) -> Option<Protocol> {
        self.installed.get(socket).copied()
    }
}

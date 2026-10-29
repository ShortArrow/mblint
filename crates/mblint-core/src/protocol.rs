//! Link protocols a device can run over a socket.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Protocol {
    Pcie,
    Sata,
    Usb4,
    Usb3Gen1x1,
    Displayport,
}

impl Protocol {
    /// Every protocol, in declaration order.
    pub const ALL: [Protocol; 5] = [
        Protocol::Pcie,
        Protocol::Sata,
        Protocol::Usb4,
        Protocol::Usb3Gen1x1,
        Protocol::Displayport,
    ];
}

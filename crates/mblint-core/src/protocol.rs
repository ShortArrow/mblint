//! Link protocols a device can run over a socket.

use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Protocol {
    Pcie,
    Sata,
    Usb4,
    Usb3Gen1x1,
}

//! Pass 1: connector fit and obstruction between cards.

use std::collections::BTreeMap;

use crate::board::{Board, Socket};
use crate::connector::{M2Key, PcieWidth};
use crate::device::{Device, DeviceKind};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Diagnostic {
    /// A device is bound to a socket id the board does not define.
    UnknownSocket { socket: String },
    /// The device is not made for this category of socket, such as a card in an M.2 slot.
    WrongSocketCategory { socket: String },
    /// The card edge is wider than a closed-ended slot.
    EdgeTooWide {
        socket: String,
        edge: PcieWidth,
        slot: PcieWidth,
    },
    /// The slot's key is not among the module's notches.
    KeyMismatch { socket: String, slot: M2Key },
    /// The card in `by` covers the slot holding the device in `socket`.
    Obstructed { socket: String, by: String },
}

/// Checks that each installed device fits its socket and that no card covers a slot holding
/// another device.
///
/// Fit diagnostics come first, ordered by socket id, followed by obstructions ordered by the
/// obstructed socket. A socket covered by several cards is reported once, against the card
/// with the smallest socket id.
pub fn check_physical(board: &Board, installed: &BTreeMap<String, Device>) -> Vec<Diagnostic> {
    let mut diagnostics: Vec<Diagnostic> = installed
        .iter()
        .filter_map(|(id, device)| match board.socket(id) {
            None => Some(Diagnostic::UnknownSocket { socket: id.clone() }),
            Some(socket) => misfit(id, socket, device),
        })
        .collect();
    diagnostics.extend(obstructions(board, installed));
    diagnostics
}

fn misfit(id: &str, socket: &Socket, device: &Device) -> Option<Diagnostic> {
    match (socket, &device.kind) {
        (Socket::PcieSlot(slot), DeviceKind::Card { physical, .. }) => {
            let fits = physical.edge <= slot.physical_form_factor || slot.open_ended;
            (!fits).then(|| Diagnostic::EdgeTooWide {
                socket: id.to_string(),
                edge: physical.edge,
                slot: slot.physical_form_factor,
            })
        }
        (Socket::M2Slot(slot), DeviceKind::M2Module { physical, .. }) => {
            (!physical.keys.contains(&slot.key)).then(|| Diagnostic::KeyMismatch {
                socket: id.to_string(),
                slot: slot.key,
            })
        }
        _ => Some(Diagnostic::WrongSocketCategory {
            socket: id.to_string(),
        }),
    }
}

fn obstructions(board: &Board, installed: &BTreeMap<String, Device>) -> Vec<Diagnostic> {
    let occupied_slots: Vec<(&str, u16)> = installed
        .keys()
        .filter_map(|id| match board.socket(id) {
            Some(Socket::PcieSlot(slot)) => Some((id.as_str(), u16::from(slot.slot_index))),
            _ => None,
        })
        .collect();

    let mut covered_by: BTreeMap<&str, &str> = BTreeMap::new();
    for (id, device) in installed {
        let (Some(Socket::PcieSlot(slot)), DeviceKind::Card { physical, .. }) =
            (board.socket(id), &device.kind)
        else {
            continue;
        };
        let first = u16::from(slot.slot_index);
        let last = first + u16::from(physical.thickness_slots.get()) - 1;
        for (other, index) in &occupied_slots {
            if *other != id.as_str() && (first + 1..=last).contains(index) {
                covered_by.entry(other).or_insert(id);
            }
        }
    }

    covered_by
        .into_iter()
        .map(|(socket, by)| Diagnostic::Obstructed {
            socket: socket.to_string(),
            by: by.to_string(),
        })
        .collect()
}

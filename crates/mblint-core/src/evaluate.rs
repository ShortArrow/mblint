//! The resolution pipeline: each pass runs only if the passes before it reported no error.

use crate::lanes::{LaneResolution, resolve_lanes};
use crate::occupancy::Occupancy;
use crate::physical::{self, check_physical};
use crate::rig::LoadedRig;

/// The outcome of every pass, in pipeline order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Evaluation {
    /// Pass 1. Every diagnostic is an error.
    pub physical: Vec<physical::Diagnostic>,
    /// Pass 2, not run if Pass 1 reported an error.
    pub lanes: PassOutcome<LaneResolution>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PassOutcome<T> {
    Ran(T),
    /// An earlier pass reported an error, so this pass was not run.
    NotRun,
}

pub fn evaluate(rig: &LoadedRig) -> Evaluation {
    let physical = check_physical(&rig.board, &rig.installed);
    let lanes = if physical.is_empty() {
        PassOutcome::Ran(resolve_lanes(&rig.board, &occupancy(rig)))
    } else {
        PassOutcome::NotRun
    };
    Evaluation { physical, lanes }
}

/// The devices in board sockets; a device inside an adapter draws on no board lanes.
fn occupancy(rig: &LoadedRig) -> Occupancy {
    let mut occupancy = Occupancy::default();
    let board_sockets = rig.installed.iter().filter(|(path, _)| !path.contains('.'));
    for (socket, device) in board_sockets {
        occupancy.install(socket.clone(), device.protocol());
    }
    occupancy
}

//! The resolution pipeline: each pass runs only if the passes before it reported no error.

use crate::iommu::{SharedIommuGroup, shared_iommu_groups};
use crate::lanes::{LaneResolution, resolve_lanes};
use crate::occupancy::Occupancy;
use crate::physical::{self, check_physical};
use crate::rig::LoadedRig;
use crate::throughput::{Throughput, rate_links};
use crate::tunnels::{Tunnelling, resolve_tunnels};

/// The outcome of every pass, in pipeline order.
#[derive(Debug, Clone, PartialEq)]
pub struct Evaluation {
    /// Pass 1. Every diagnostic is an error.
    pub physical: Vec<physical::Diagnostic>,
    /// Pass 2, not run if Pass 1 reported an error. Every diagnostic is an error.
    pub lanes: PassOutcome<LaneResolution>,
    /// Pass 3, not run if Pass 2 did not run or reported an error.
    pub tunnels: PassOutcome<Tunnelling>,
    /// Pass 4, not run if Pass 3 did not run or reported an error. Every diagnostic is a warning.
    pub throughput: PassOutcome<Throughput>,
    /// Pass 4, under the same condition as `throughput`. Every diagnostic is a warning.
    pub iommu: PassOutcome<Vec<SharedIommuGroup>>,
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
    let clean_lanes = match &lanes {
        PassOutcome::Ran(resolution) if resolution.diagnostics.is_empty() => Some(resolution),
        _ => None,
    };
    let tunnels = match clean_lanes {
        Some(_) => PassOutcome::Ran(resolve_tunnels(&rig.board, &rig.installed)),
        None => PassOutcome::NotRun,
    };
    let (throughput, iommu) = match (clean_lanes, &tunnels) {
        (Some(resolution), PassOutcome::Ran(tunnels))
            if !tunnels.diagnostics.iter().any(|d| d.is_error()) =>
        {
            (
                PassOutcome::Ran(rate_links(&rig.board, &rig.installed, resolution, tunnels)),
                PassOutcome::Ran(shared_iommu_groups(&rig.board, &rig.installed)),
            )
        }
        _ => (PassOutcome::NotRun, PassOutcome::NotRun),
    };
    Evaluation {
        physical,
        lanes,
        tunnels,
        throughput,
        iommu,
    }
}

/// The devices in board sockets; a device inside an adapter draws on no board lanes.
pub(crate) fn occupancy(rig: &LoadedRig) -> Occupancy {
    let mut occupancy = Occupancy::default();
    let board_sockets = rig.installed.iter().filter(|(path, _)| !path.contains('.'));
    for (socket, device) in board_sockets {
        occupancy.install(socket.clone(), device.protocol());
    }
    occupancy
}

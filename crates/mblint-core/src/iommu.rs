//! Pass 4: IOMMU groups whose devices can be passed through to a virtual machine only together.

use std::collections::{BTreeMap, BTreeSet};

use crate::board::{Board, Node};
use crate::device::Device;

/// A group whose endpoints, the occupied sockets and controllers carrying its number, must be
/// passed through together under VFIO.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SharedIommuGroup {
    pub group: u32,
    /// Node ids in order.
    pub endpoints: Vec<String>,
}

/// The groups with more than one endpoint, at least one of them an occupied socket, in group
/// number order. Devices inside adapters are in no group of the board.
pub fn shared_iommu_groups(
    board: &Board,
    installed: &BTreeMap<String, Device>,
) -> Vec<SharedIommuGroup> {
    let mut endpoints: BTreeMap<u32, BTreeSet<&str>> = BTreeMap::new();
    let mut occupied_groups = BTreeSet::new();

    for (id, node) in &board.nodes {
        match node {
            Node::Controller(controller) => {
                endpoints
                    .entry(controller.iommu_group)
                    .or_default()
                    .insert(id);
            }
            Node::Socket(socket) if installed.contains_key(id) => {
                if let Some(group) = socket.iommu_group() {
                    endpoints.entry(group).or_default().insert(id);
                    occupied_groups.insert(group);
                }
            }
            _ => {}
        }
    }

    endpoints
        .into_iter()
        .filter(|(group, ids)| occupied_groups.contains(group) && ids.len() > 1)
        .map(|(group, ids)| SharedIommuGroup {
            group,
            endpoints: ids.into_iter().map(str::to_string).collect(),
        })
        .collect()
}

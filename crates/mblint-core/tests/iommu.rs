use std::collections::BTreeMap;

use mblint_core::board::Board;
use mblint_core::device::Device;
use mblint_core::iommu::{SharedIommuGroup, shared_iommu_groups};
use mblint_core::lanes::resolve_lanes;
use mblint_core::occupancy::Occupancy;

const BOARD: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "IOMMU Board"

[nodes.root_pch]
type = "root"
bus = "pcie"
lanes = 8
generation = 4

[nodes.mux_pch]
type = "mux"
subtype = "bifurcation"
parent = "root_pch"

[[nodes.mux_pch.modes]]
when = { socket = "PCI_E2", is = "empty" }
allocate = { PCI_E3 = 4 }

[[nodes.mux_pch.modes]]
when = { socket = "PCI_E2", is = "occupied" }
allocate = { PCI_E2 = 4, PCI_E3 = 4 }

[nodes.PCI_E2]
type = "socket"
category = "pcie_slot"
parent = "mux_pch"
slot_index = 4
physical_form_factor = "x16"
iommu_group = 14

[nodes.PCI_E3]
type = "socket"
category = "pcie_slot"
parent = "mux_pch"
slot_index = 6
physical_form_factor = "x16"
iommu_group = 14

[nodes.PCI_E4]
type = "socket"
category = "pcie_slot"
parent = "mux_pch"
slot_index = 7
physical_form_factor = "x16"
iommu_group = 15

[nodes.ONBOARD_SATA_CONTROLLER]
type = "controller"
iommu_group = 14
"#;

const CARD: &str = r#"
schema_version = "2.0.0"
id = "card"
name = "Test Card"
type = "card"

[interface]
protocol = "pcie"
generation = 4
lanes = 4

[physical]
edge = "x4"
thickness_slots = 1
length_mm = 120
"#;

fn board() -> Board {
    Board::from_toml(BOARD).expect("fixture board must parse")
}

fn shared(sockets: &[&str]) -> Vec<SharedIommuGroup> {
    let installed: BTreeMap<String, Device> = sockets
        .iter()
        .map(|socket| {
            let card = Device::from_toml(CARD).expect("fixture card must parse");
            (socket.to_string(), card)
        })
        .collect();
    shared_iommu_groups(&board(), &installed)
}

#[test]
fn occupied_socket_sharing_a_group_with_a_controller_is_reported() {
    assert_eq!(
        shared(&["PCI_E2"]),
        vec![SharedIommuGroup {
            group: 14,
            endpoints: vec!["ONBOARD_SATA_CONTROLLER".into(), "PCI_E2".into()],
        }]
    );
}

#[test]
fn every_occupied_socket_of_the_group_is_an_endpoint() {
    assert_eq!(
        shared(&["PCI_E2", "PCI_E3"]),
        vec![SharedIommuGroup {
            group: 14,
            endpoints: vec![
                "ONBOARD_SATA_CONTROLLER".into(),
                "PCI_E2".into(),
                "PCI_E3".into(),
            ],
        }]
    );
}

#[test]
fn occupied_socket_alone_in_its_group_is_not_reported() {
    assert!(shared(&["PCI_E4"]).is_empty());
}

#[test]
fn group_with_no_occupied_socket_is_not_reported() {
    assert!(shared(&[]).is_empty());
}

#[test]
fn device_inside_an_adapter_belongs_to_no_board_group() {
    assert!(shared(&["PCI_E4.SLOT"]).is_empty());
}

#[test]
fn controller_draws_no_lanes() {
    let mut occupancy = Occupancy::default();
    occupancy.install("PCI_E3", mblint_core::protocol::Protocol::Pcie);

    let result = resolve_lanes(&board(), &occupancy);

    assert!(result.diagnostics.is_empty());
}

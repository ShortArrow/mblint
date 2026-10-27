//! Rigs on the reference boards under `data/boards/` resolve as their manuals describe.

use std::collections::BTreeMap;

use mblint_core::board::Board;
use mblint_core::device::Device;
use mblint_core::lanes::{LaneResolution, resolve_lanes};
use mblint_core::occupancy::Occupancy;
use mblint_core::physical::{self, check_physical};
use mblint_core::throughput::{Diagnostic, Link, Throughput, rate_links};
use mblint_core::tunnels::resolve_tunnels;

const MAG_X870E_TOMAHAWK_WIFI: &str =
    include_str!("../../../data/boards/msi/mag_x870e_tomahawk_wifi.toml");

const MAG_Z890_TOMAHAWK_WIFI: &str =
    include_str!("../../../data/boards/msi/mag_z890_tomahawk_wifi.toml");

const CARD_GEN4_X16: &str = r#"
schema_version = "2.0.0"
id = "card"
name = "Test Card"
type = "card"

[interface]
protocol = "pcie"
generation = 4
lanes = 16

[physical]
edge = "x16"
thickness_slots = 2
length_mm = 240
"#;

const SSD_GEN5_X4: &str = r#"
schema_version = "2.0.0"
id = "ssd"
name = "Test SSD"
type = "m2_module"

[interface]
protocol = "pcie"
generation = 5
lanes = 4

[physical]
keys = ["M"]
form_factor = "2280"
"#;

fn tomahawk() -> Board {
    Board::from_toml(MAG_X870E_TOMAHAWK_WIFI).expect("reference board must parse")
}

fn z890_tomahawk() -> Board {
    Board::from_toml(MAG_Z890_TOMAHAWK_WIFI).expect("reference board must parse")
}

fn installed(devices: &[(&str, &str)]) -> BTreeMap<String, Device> {
    devices
        .iter()
        .map(|(socket, source)| {
            let device = Device::from_toml(source).expect("fixture device must parse");
            (socket.to_string(), device)
        })
        .collect()
}

/// Passes 2 and 4 over devices bound to the board.
fn resolve(board: &Board, devices: &[(&str, &str)]) -> (LaneResolution, Throughput) {
    let installed = installed(devices);
    let mut occupancy = Occupancy::default();
    for (socket, device) in &installed {
        occupancy.install(socket.clone(), device.protocol());
    }
    let lanes = resolve_lanes(board, &occupancy);
    let tunnels = resolve_tunnels(board, &installed);
    let throughput = rate_links(board, &installed, &lanes, &tunnels);
    (lanes, throughput)
}

fn lane(generation: u8) -> f64 {
    let transfers = match generation {
        3 => 8.0,
        4 => 16.0,
        _ => 32.0,
    };
    transfers * 128.0 / 130.0
}

#[test]
fn tomahawk_card_in_pci_e1_runs_at_its_own_rate() {
    let (lanes, throughput) = resolve(&tomahawk(), &[("PCI_E1", CARD_GEN4_X16)]);

    assert!(lanes.diagnostics.is_empty());
    assert_eq!(
        throughput.links.get("PCI_E1"),
        Some(&Link {
            generation: 4,
            lanes: 16,
            gbps: lane(4) * 16.0,
        })
    );
    assert!(throughput.diagnostics.is_empty());
}

#[test]
fn tomahawk_ssd_in_m2_2_halves_the_usb4_controller_and_itself() {
    let (lanes, throughput) = resolve(&tomahawk(), &[("M2_2", SSD_GEN5_X4)]);

    assert_eq!(lanes.allocations.get("bridge_asm4242"), Some(&2));
    assert!(lanes.diagnostics.is_empty());
    assert_eq!(
        throughput.diagnostics,
        vec![Diagnostic::Bottleneck {
            socket: "M2_2".into(),
            required_gbps: lane(5) * 4.0,
            actual_gbps: lane(5) * 2.0,
        }]
    );
}

#[test]
fn tomahawk_pci_e2_runs_pcie_3_0_x1() {
    let (_, throughput) = resolve(&tomahawk(), &[("PCI_E2", CARD_GEN4_X16)]);

    assert_eq!(
        throughput.links.get("PCI_E2"),
        Some(&Link {
            generation: 3,
            lanes: 1,
            gbps: lane(3),
        })
    );
}

#[test]
fn tomahawk_four_slot_card_in_pci_e1_covers_pci_e2() {
    let thick_card = CARD_GEN4_X16.replace("thickness_slots = 2", "thickness_slots = 4");
    let devices = installed(&[("PCI_E1", &thick_card), ("PCI_E2", CARD_GEN4_X16)]);

    assert_eq!(
        check_physical(&tomahawk(), &devices),
        vec![physical::Diagnostic::Obstructed {
            socket: "PCI_E2".into(),
            by: "PCI_E1".into(),
        }]
    );
}

#[test]
fn z890_tomahawk_gen5_ssd_in_m2_1_runs_at_its_own_rate() {
    let (_, throughput) = resolve(&z890_tomahawk(), &[("M2_1", SSD_GEN5_X4)]);

    assert!(throughput.diagnostics.is_empty());
}

#[test]
fn z890_tomahawk_gen5_ssd_in_m2_2_is_held_to_pcie_4_0() {
    let (_, throughput) = resolve(&z890_tomahawk(), &[("M2_2", SSD_GEN5_X4)]);

    assert_eq!(
        throughput.diagnostics,
        vec![Diagnostic::Bottleneck {
            socket: "M2_2".into(),
            required_gbps: lane(5) * 4.0,
            actual_gbps: lane(4) * 4.0,
        }]
    );
}

#[test]
fn z890_tomahawk_card_in_pci_e2_runs_at_x4() {
    let (_, throughput) = resolve(&z890_tomahawk(), &[("PCI_E2", CARD_GEN4_X16)]);

    assert_eq!(
        throughput.links.get("PCI_E2"),
        Some(&Link {
            generation: 4,
            lanes: 4,
            gbps: lane(4) * 4.0,
        })
    );
}

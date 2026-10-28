//! Rigs on the reference boards under `data/boards/` resolve as their manuals describe.

use std::collections::BTreeMap;

use mblint_core::board::Board;
use mblint_core::device::Device;
use mblint_core::lanes::{LaneResolution, resolve_lanes};
use mblint_core::occupancy::Occupancy;
use mblint_core::physical::{self, check_physical};
use mblint_core::throughput::{Diagnostic, Link, Throughput, rate_links};
use mblint_core::tunnels::{self, resolve_tunnels};

const MAG_X870E_TOMAHAWK_WIFI: &str =
    include_str!("../../../data/boards/msi/mag_x870e_tomahawk_wifi.toml");

const MAG_Z890_TOMAHAWK_WIFI: &str =
    include_str!("../../../data/boards/msi/mag_z890_tomahawk_wifi.toml");

const PROART_X870E_CREATOR_WIFI: &str =
    include_str!("../../../data/boards/asus/proart_x870e_creator_wifi.toml");

const ROG_STRIX_Z890_F_GAMING_WIFI: &str =
    include_str!("../../../data/boards/asus/rog_strix_z890_f_gaming_wifi.toml");

const B850M_D3HP: &str = include_str!("../../../data/boards/gigabyte/b850m_d3hp.toml");

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

const MONITOR: &str = r#"
schema_version = "2.0.0"
id = "monitor"
name = "Test Monitor"
type = "display"

[display]
resolution = "3840x2160"
refresh_rate = 60
dsc_supported = false
required_dp_lanes = 4
bandwidth_requirement_gbps = 12.54
"#;

fn x870e_tomahawk() -> Board {
    Board::from_toml(MAG_X870E_TOMAHAWK_WIFI).expect("reference board must parse")
}

fn z890_tomahawk() -> Board {
    Board::from_toml(MAG_Z890_TOMAHAWK_WIFI).expect("reference board must parse")
}

fn proart_x870e() -> Board {
    Board::from_toml(PROART_X870E_CREATOR_WIFI).expect("reference board must parse")
}

fn strix_z890_f() -> Board {
    Board::from_toml(ROG_STRIX_Z890_F_GAMING_WIFI).expect("reference board must parse")
}

fn b850m_d3hp() -> Board {
    Board::from_toml(B850M_D3HP).expect("reference board must parse")
}

fn card_of_thickness(slots: u8) -> String {
    CARD_GEN4_X16.replace("thickness_slots = 2", &format!("thickness_slots = {slots}"))
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

/// Pass 3 diagnostics for a monitor bound to `socket`.
fn monitor_on(board: &Board, socket: &str) -> Vec<tunnels::Diagnostic> {
    resolve_tunnels(board, &installed(&[(socket, MONITOR)])).diagnostics
}

fn dp_lanes_unknown(socket: &str) -> Vec<tunnels::Diagnostic> {
    vec![tunnels::Diagnostic::DpLanesUnknown {
        socket: socket.into(),
    }]
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
fn x870e_tomahawk_card_in_pci_e1_runs_at_its_own_rate() {
    let (lanes, throughput) = resolve(&x870e_tomahawk(), &[("PCI_E1", CARD_GEN4_X16)]);

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
fn x870e_tomahawk_ssd_in_m2_2_halves_the_usb4_controller_and_itself() {
    let (lanes, throughput) = resolve(&x870e_tomahawk(), &[("M2_2", SSD_GEN5_X4)]);

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
fn x870e_tomahawk_pci_e2_runs_pcie_3_0_x1() {
    let (_, throughput) = resolve(&x870e_tomahawk(), &[("PCI_E2", CARD_GEN4_X16)]);

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
fn x870e_tomahawk_four_slot_card_in_pci_e1_covers_pci_e2() {
    let thick_card = CARD_GEN4_X16.replace("thickness_slots = 2", "thickness_slots = 4");
    let devices = installed(&[("PCI_E1", &thick_card), ("PCI_E2", CARD_GEN4_X16)]);

    assert_eq!(
        check_physical(&x870e_tomahawk(), &devices),
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

#[test]
fn proart_x870e_card_alone_gets_x16() {
    let (_, throughput) = resolve(&proart_x870e(), &[("PCIEX16(G5)_1", CARD_GEN4_X16)]);

    assert!(throughput.diagnostics.is_empty());
}

#[test]
fn proart_x870e_two_cards_split_x8_x8() {
    let (lanes, _) = resolve(
        &proart_x870e(),
        &[
            ("PCIEX16(G5)_1", CARD_GEN4_X16),
            ("PCIEX16(G5)_2", CARD_GEN4_X16),
        ],
    );

    assert_eq!(lanes.allocations.get("PCIEX16(G5)_1"), Some(&8));
    assert_eq!(lanes.allocations.get("PCIEX16(G5)_2"), Some(&8));
    assert!(lanes.diagnostics.is_empty());
}

#[test]
fn proart_x870e_ssd_in_m2_2_leaves_the_first_slot_x8() {
    let (lanes, throughput) = resolve(
        &proart_x870e(),
        &[("PCIEX16(G5)_1", CARD_GEN4_X16), ("M2_2", SSD_GEN5_X4)],
    );

    assert_eq!(lanes.allocations.get("M2_2"), Some(&4));
    assert_eq!(
        throughput.diagnostics,
        vec![Diagnostic::Bottleneck {
            socket: "PCIEX16(G5)_1".into(),
            required_gbps: lane(4) * 16.0,
            actual_gbps: lane(4) * 8.0,
        }]
    );
}

#[test]
fn strix_z890_f_gen5_ssd_in_m2_2_is_held_to_pcie_4_0() {
    let (_, throughput) = resolve(&strix_z890_f(), &[("M2_2", SSD_GEN5_X4)]);

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
fn strix_z890_f_card_in_the_chipset_slot_runs_at_x4() {
    let (_, throughput) = resolve(&strix_z890_f(), &[("PCIEX16(G4)", CARD_GEN4_X16)]);

    assert_eq!(
        throughput.links.get("PCIEX16(G4)").map(|link| link.lanes),
        Some(4)
    );
}

#[test]
fn strix_z890_f_four_slot_card_leaves_the_chipset_slot_free() {
    let thick_card = CARD_GEN4_X16.replace("thickness_slots = 2", "thickness_slots = 4");
    let devices = installed(&[("PCIEX16(G5)", &thick_card), ("PCIEX16(G4)", CARD_GEN4_X16)]);

    assert!(check_physical(&strix_z890_f(), &devices).is_empty());
}

#[test]
fn x870e_tomahawk_usb4_ports_carry_displayport_of_unknown_lanes() {
    assert_eq!(
        monitor_on(&x870e_tomahawk(), "PORT_USB4_1"),
        dp_lanes_unknown("PORT_USB4_1")
    );
}

#[test]
fn z890_tomahawk_thunderbolt_ports_carry_displayport_of_unknown_lanes() {
    assert_eq!(
        monitor_on(&z890_tomahawk(), "PORT_TB4_1"),
        dp_lanes_unknown("PORT_TB4_1")
    );
}

#[test]
fn proart_x870e_usb4_ports_carry_displayport_of_unknown_lanes() {
    assert_eq!(monitor_on(&proart_x870e(), "EC1"), dp_lanes_unknown("EC1"));
}

#[test]
fn proart_x870e_usb_20gbps_port_has_no_dp_alt_mode() {
    assert_eq!(
        monitor_on(&proart_x870e(), "C18"),
        vec![tunnels::Diagnostic::DpAltModeUnsupported {
            socket: "C18".into(),
        }]
    );
}

#[test]
fn strix_z890_f_thunderbolt_ports_carry_displayport_of_unknown_lanes() {
    assert_eq!(monitor_on(&strix_z890_f(), "C1"), dp_lanes_unknown("C1"));
}

#[test]
fn strix_z890_f_monitor_fits_a_type_c_port() {
    let devices = installed(&[("C1", MONITOR)]);

    assert!(check_physical(&strix_z890_f(), &devices).is_empty());
}

#[test]
fn b850m_d3hp_gen5_ssd_in_m2b_cpu_is_held_to_pcie_4_0() {
    let (_, throughput) = resolve(&b850m_d3hp(), &[("M2B_CPU", SSD_GEN5_X4)]);

    assert_eq!(
        throughput.diagnostics,
        vec![Diagnostic::Bottleneck {
            socket: "M2B_CPU".into(),
            required_gbps: lane(5) * 4.0,
            actual_gbps: lane(4) * 4.0,
        }]
    );
}

#[test]
fn b850m_d3hp_pciex4_runs_pcie_3_0_x4() {
    let (_, throughput) = resolve(&b850m_d3hp(), &[("PCIEX4", CARD_GEN4_X16)]);

    assert_eq!(
        throughput.links.get("PCIEX4"),
        Some(&Link {
            generation: 3,
            lanes: 4,
            gbps: lane(3) * 4.0,
        })
    );
}

#[test]
fn b850m_d3hp_four_slot_card_covers_pciex4() {
    let thick_card = card_of_thickness(4);
    let devices = installed(&[("PCIEX16", &thick_card), ("PCIEX4", CARD_GEN4_X16)]);

    assert_eq!(
        check_physical(&b850m_d3hp(), &devices),
        vec![physical::Diagnostic::Obstructed {
            socket: "PCIEX4".into(),
            by: "PCIEX16".into(),
        }]
    );
}

#[test]
fn b850m_d3hp_three_slot_card_leaves_pciex4_free() {
    let thick_card = card_of_thickness(3);
    let devices = installed(&[("PCIEX16", &thick_card), ("PCIEX4", CARD_GEN4_X16)]);

    assert!(check_physical(&b850m_d3hp(), &devices).is_empty());
}

use std::collections::BTreeMap;

use mblint_core::board::Board;
use mblint_core::connector::{M2Key, PcieWidth};
use mblint_core::device::Device;
use mblint_core::physical::{Diagnostic, check_physical};

const BOARD: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Slot Layout Board"

[nodes.root_cpu_peg]
type = "root"
bus = "pcie"
lanes = 16
generation = 5

[nodes.PCI_E1]
type = "socket"
category = "pcie_slot"
parent = "root_cpu_peg"
slot_index = 2
physical_form_factor = "x16"

[nodes.PCI_E2]
type = "socket"
category = "pcie_slot"
parent = "root_cpu_peg"
slot_index = 4
physical_form_factor = "x16"

[nodes.PCI_E3]
type = "socket"
category = "pcie_slot"
parent = "root_cpu_peg"
slot_index = 6
physical_form_factor = "x4"

[nodes.PCI_E4]
type = "socket"
category = "pcie_slot"
parent = "root_cpu_peg"
slot_index = 7
physical_form_factor = "x4"
open_ended = true

[nodes.M2_1]
type = "socket"
category = "m2_slot"
parent = "root_cpu_peg"
key = "M"
"#;

fn board() -> Board {
    Board::from_toml(BOARD).expect("fixture board must parse")
}

fn card(edge: &str, thickness_slots: u8) -> Device {
    Device::from_toml(&format!(
        r#"
schema_version = "2.0.0"
id = "test_card"
name = "Test Card"
type = "card"

[interface]
protocol = "pcie"
generation = 4
lanes = 16

[physical]
edge = "{edge}"
thickness_slots = {thickness_slots}
length_mm = 300
"#
    ))
    .expect("fixture card must parse")
}

fn m2_module(keys: &str) -> Device {
    Device::from_toml(&format!(
        r#"
schema_version = "2.0.0"
id = "test_ssd"
name = "Test SSD"
type = "m2_module"

[interface]
protocol = "pcie"
generation = 5
lanes = 4

[physical]
keys = {keys}
form_factor = "2280"
"#
    ))
    .expect("fixture module must parse")
}

fn installed(devices: Vec<(&str, Device)>) -> BTreeMap<String, Device> {
    devices
        .into_iter()
        .map(|(socket, device)| (socket.to_string(), device))
        .collect()
}

#[test]
fn thick_card_obstructs_a_device_in_a_slot_it_covers() {
    let devices = installed(vec![("PCI_E1", card("x16", 4)), ("PCI_E2", card("x16", 2))]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![Diagnostic::Obstructed {
            socket: "PCI_E2".into(),
            by: "PCI_E1".into(),
        }]
    );
}

#[test]
fn card_ending_above_the_next_device_does_not_obstruct_it() {
    let devices = installed(vec![("PCI_E1", card("x16", 2)), ("PCI_E2", card("x16", 2))]);

    assert!(check_physical(&board(), &devices).is_empty());
}

#[test]
fn x16_card_does_not_fit_a_closed_x4_slot() {
    let devices = installed(vec![("PCI_E3", card("x16", 1))]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![Diagnostic::EdgeTooWide {
            socket: "PCI_E3".into(),
            edge: PcieWidth::X16,
            slot: PcieWidth::X4,
        }]
    );
}

#[test]
fn x16_card_fits_an_open_ended_x4_slot() {
    let devices = installed(vec![("PCI_E4", card("x16", 1))]);

    assert!(check_physical(&board(), &devices).is_empty());
}

#[test]
fn m_key_module_fits_an_m_key_slot() {
    let devices = installed(vec![("M2_1", m2_module(r#"["M"]"#))]);

    assert!(check_physical(&board(), &devices).is_empty());
}

#[test]
fn b_key_module_does_not_fit_an_m_key_slot() {
    let devices = installed(vec![("M2_1", m2_module(r#"["B"]"#))]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![Diagnostic::KeyMismatch {
            socket: "M2_1".into(),
            slot: M2Key::M,
        }]
    );
}

#[test]
fn card_in_an_m2_slot_is_in_the_wrong_socket() {
    let devices = installed(vec![("M2_1", card("x4", 1))]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![Diagnostic::WrongSocketCategory {
            socket: "M2_1".into(),
        }]
    );
}

#[test]
fn device_bound_to_a_socket_the_board_lacks_is_reported() {
    let devices = installed(vec![("PCI_E9", card("x16", 1))]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![Diagnostic::UnknownSocket {
            socket: "PCI_E9".into(),
        }]
    );
}

#[test]
fn misplaced_socket_attribute_is_rejected_at_parse_time() {
    let toml = BOARD.replace(r#"key = "M""#, "key = \"M\"\nslot_index = 3");

    assert!(Board::from_toml(&toml).is_err());
}

#[test]
fn device_protocol_is_read_from_its_interface() {
    assert_eq!(
        m2_module(r#"["B", "M"]"#).protocol(),
        mblint_core::protocol::Protocol::Pcie
    );
}

fn board_with_m2_1_sizes(sizes: &str) -> Board {
    Board::from_toml(&BOARD.replace(
        r#"key = "M""#,
        &format!("key = \"M\"\nsupported_form_factors = {sizes}"),
    ))
    .expect("fixture board must parse")
}

fn module_of_size(keys: &str, size: &str) -> Device {
    Device::from_toml(&format!(
        r#"
schema_version = "2.0.0"
id = "test_ssd"
name = "Test SSD"
type = "m2_module"

[interface]
protocol = "pcie"
generation = 5
lanes = 4

[physical]
keys = {keys}
form_factor = "{size}"
"#
    ))
    .expect("fixture module must parse")
}

#[test]
fn module_without_a_screw_position_in_the_slot_does_not_fit() {
    let board = board_with_m2_1_sizes(r#"["2242", "2280"]"#);
    let devices = installed(vec![("M2_1", module_of_size(r#"["M"]"#, "22110"))]);

    assert_eq!(
        check_physical(&board, &devices),
        vec![Diagnostic::FormFactorUnsupported {
            socket: "M2_1".into(),
            form_factor: "22110".into(),
            slot: vec!["2242".into(), "2280".into()],
        }]
    );
}

#[test]
fn module_of_a_listed_size_fits_and_an_unlisted_slot_takes_any_size() {
    let listed = board_with_m2_1_sizes(r#"["2242", "2280"]"#);
    let devices = installed(vec![("M2_1", module_of_size(r#"["M"]"#, "2242"))]);
    assert!(check_physical(&listed, &devices).is_empty());

    let devices = installed(vec![("M2_1", module_of_size(r#"["M"]"#, "22110"))]);
    assert!(check_physical(&board(), &devices).is_empty());
}

#[test]
fn module_whose_key_does_not_fit_is_reported_for_its_key_alone() {
    let board = board_with_m2_1_sizes(r#"["2280"]"#);
    let devices = installed(vec![("M2_1", module_of_size(r#"["B"]"#, "22110"))]);

    assert_eq!(
        check_physical(&board, &devices),
        vec![Diagnostic::KeyMismatch {
            socket: "M2_1".into(),
            slot: M2Key::M,
        }]
    );
}

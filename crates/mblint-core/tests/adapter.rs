use std::collections::BTreeMap;

use mblint_core::board::Board;
use mblint_core::device::Device;
use mblint_core::evaluate::{PassOutcome, evaluate};
use mblint_core::physical::{Diagnostic, check_physical};
use mblint_core::protocol::Protocol;
use mblint_core::rig::load_rig;

const BOARD: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Adapter Board"

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

[nodes.PORT_TYPEC_1]
type = "socket"
category = "usb_c"
parent = "root_cpu_peg"

[nodes.PORT_USBA_1]
type = "socket"
category = "usb_a"
parent = "root_cpu_peg"
"#;

const EGPU_BOX: &str = r#"
schema_version = "2.0.0"
id = "egpu_box"
name = "Test eGPU Box"
type = "adapter"

[upstream]
connector = "type_c"
protocol = "usb4"

[bridge]
translates_to = "pcie"
max_tunneling_gbps = 32.0

[downstream_sockets.EGPU_SLOT]
category = "pcie_slot"
physical_form_factor = "x16"
max_electrical_lanes = 4
generation = 3
"#;

const USB_SATA: &str = r#"
schema_version = "2.0.0"
id = "usb_sata"
name = "Test USB to SATA Adapter"
type = "adapter"

[upstream]
connector = "type_a"
protocol = "usb3_gen1x1"
max_gbps = 5.0

[bridge]
translates_to = "sata"
sata_generation = 3
"#;

const CARD: &str = r#"
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

const SSD: &str = r#"
schema_version = "2.0.0"
id = "ssd"
name = "Test SSD"
type = "m2_module"

[interface]
protocol = "pcie"
generation = 4
lanes = 4

[physical]
keys = ["M"]
form_factor = "2280"
"#;

fn board() -> Board {
    Board::from_toml(BOARD).expect("fixture board must parse")
}

fn device(source: &str) -> Device {
    Device::from_toml(source).expect("fixture device must parse")
}

fn installed(devices: &[(&str, &str)]) -> BTreeMap<String, Device> {
    devices
        .iter()
        .map(|(socket, source)| (socket.to_string(), device(source)))
        .collect()
}

#[test]
fn card_in_an_egpu_box_slot_fits() {
    let devices = installed(&[("PORT_TYPEC_1", EGPU_BOX), ("PORT_TYPEC_1.EGPU_SLOT", CARD)]);

    assert!(check_physical(&board(), &devices).is_empty());
}

#[test]
fn card_wider_than_a_closed_adapter_slot_does_not_fit() {
    let narrow_box = EGPU_BOX.replace(
        r#"physical_form_factor = "x16""#,
        r#"physical_form_factor = "x4""#,
    );
    let devices = installed(&[
        ("PORT_TYPEC_1", &narrow_box),
        ("PORT_TYPEC_1.EGPU_SLOT", CARD),
    ]);

    assert!(matches!(
        check_physical(&board(), &devices).as_slice(),
        [Diagnostic::EdgeTooWide { socket, .. }] if socket == "PORT_TYPEC_1.EGPU_SLOT"
    ));
}

#[test]
fn module_in_an_adapter_pcie_slot_is_in_the_wrong_socket() {
    let devices = installed(&[("PORT_TYPEC_1", EGPU_BOX), ("PORT_TYPEC_1.EGPU_SLOT", SSD)]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![Diagnostic::WrongSocketCategory {
            socket: "PORT_TYPEC_1.EGPU_SLOT".into(),
        }]
    );
}

#[test]
fn binding_under_a_device_that_is_not_an_adapter_is_an_unknown_socket() {
    let devices = installed(&[("PCI_E1", CARD), ("PCI_E1.SLOT", CARD)]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![Diagnostic::UnknownSocket {
            socket: "PCI_E1.SLOT".into(),
        }]
    );
}

#[test]
fn binding_to_a_socket_the_adapter_lacks_is_an_unknown_socket() {
    let devices = installed(&[("PORT_TYPEC_1", EGPU_BOX), ("PORT_TYPEC_1.SLOT_2", CARD)]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![Diagnostic::UnknownSocket {
            socket: "PORT_TYPEC_1.SLOT_2".into(),
        }]
    );
}

#[test]
fn binding_under_an_empty_socket_is_an_unknown_socket() {
    let devices = installed(&[("PORT_TYPEC_1.EGPU_SLOT", CARD)]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![Diagnostic::UnknownSocket {
            socket: "PORT_TYPEC_1.EGPU_SLOT".into(),
        }]
    );
}

#[test]
fn adapters_fit_the_usb_socket_matching_their_connector() {
    let devices = installed(&[("PORT_TYPEC_1", EGPU_BOX), ("PORT_USBA_1", USB_SATA)]);

    assert!(check_physical(&board(), &devices).is_empty());
}

#[test]
fn type_a_adapter_does_not_fit_a_type_c_port() {
    let devices = installed(&[("PORT_TYPEC_1", USB_SATA)]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![Diagnostic::WrongSocketCategory {
            socket: "PORT_TYPEC_1".into(),
        }]
    );
}

#[test]
fn adapter_runs_its_upstream_protocol() {
    assert_eq!(device(EGPU_BOX).protocol(), Protocol::Usb4);
}

#[test]
fn rig_with_a_card_inside_an_egpu_box_is_evaluated_through_pass_2() {
    let files = BTreeMap::from([
        (
            "rigs/egpu.toml",
            r#"
schema_version = "2.0.0"
name = "eGPU Rig"
board = "boards/test/adapter_board.toml"

[bindings]
PCI_E1 = "devices/cards/card.toml"
PORT_TYPEC_1 = "devices/peripherals/egpu_box.toml"
"PORT_TYPEC_1.EGPU_SLOT" = "devices/cards/card.toml"
"#,
        ),
        ("boards/test/adapter_board.toml", BOARD),
        ("devices/cards/card.toml", CARD),
        ("devices/peripherals/egpu_box.toml", EGPU_BOX),
    ]);
    let read = |path: &str| {
        files
            .get(path)
            .map(|source| source.to_string())
            .ok_or_else(|| format!("{path}: not found"))
    };
    let loaded = load_rig("rigs/egpu.toml", read).expect("rig must load");

    let evaluation = evaluate(&loaded);

    assert!(evaluation.physical.is_empty());
    assert!(matches!(evaluation.lanes, PassOutcome::Ran(lanes) if lanes.diagnostics.is_empty()));
}

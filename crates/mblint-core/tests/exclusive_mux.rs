use std::collections::BTreeSet;

use mblint_core::board::Board;
use mblint_core::lanes::{Diagnostic, resolve_lanes};
use mblint_core::occupancy::Occupancy;
use mblint_core::protocol::Protocol;

const HEADER: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "M.2 / SATA Exclusive Board"

[nodes.root_pch_hsio]
type = "root"
bus = "hsio"
lanes = 12
generation = 4

[nodes.mux_m2_sata_exclusive]
type = "mux"
subtype = "exclusive"
parent = "root_pch_hsio"
"#;

const EMPTY_MODE: &str = r#"
[[nodes.mux_m2_sata_exclusive.modes]]
when = { socket = "M2_2", is = "empty" }
"#;

const PROTOCOL_MODES: &str = r#"
[[nodes.mux_m2_sata_exclusive.modes]]
when = { socket = "M2_2", protocol = "pcie" }
allocate = { M2_2 = 4 }
disables = ["SATA_5", "SATA_6"]

[[nodes.mux_m2_sata_exclusive.modes]]
when = { socket = "M2_2", protocol = "sata" }
"#;

const SOCKETS: &str = r#"
[nodes.M2_2]
type = "socket"
category = "m2_slot"
parent = "mux_m2_sata_exclusive"
key = "M"

[nodes.SATA_5]
type = "socket"
category = "sata_port"
parent = "root_pch_hsio"

[nodes.SATA_6]
type = "socket"
category = "sata_port"
parent = "root_pch_hsio"
"#;

fn exclusive_board() -> Board {
    Board::from_toml(&format!("{HEADER}{EMPTY_MODE}{PROTOCOL_MODES}{SOCKETS}"))
        .expect("fixture board must parse")
}

fn installed(devices: &[(&str, Protocol)]) -> Occupancy {
    let mut occupancy = Occupancy::default();
    for (socket, protocol) in devices {
        occupancy.install(*socket, *protocol);
    }
    occupancy
}

fn sockets(ids: &[&str]) -> BTreeSet<String> {
    ids.iter().map(|id| id.to_string()).collect()
}

#[test]
fn pcie_ssd_in_m2_takes_four_lanes_and_disables_the_sata_ports() {
    let result = resolve_lanes(&exclusive_board(), &installed(&[("M2_2", Protocol::Pcie)]));

    assert_eq!(result.allocations.get("M2_2"), Some(&4));
    assert_eq!(result.disabled, sockets(&["SATA_5", "SATA_6"]));
    assert!(result.diagnostics.is_empty());
}

#[test]
fn device_in_a_disabled_socket_is_reported() {
    let occupancy = installed(&[("M2_2", Protocol::Pcie), ("SATA_5", Protocol::Sata)]);

    let result = resolve_lanes(&exclusive_board(), &occupancy);

    assert_eq!(
        result.diagnostics,
        vec![Diagnostic::SocketDisabled {
            socket: "SATA_5".into(),
            mux: "mux_m2_sata_exclusive".into(),
        }]
    );
}

#[test]
fn sata_ssd_in_m2_leaves_the_sata_ports_working() {
    let occupancy = installed(&[("M2_2", Protocol::Sata), ("SATA_5", Protocol::Sata)]);

    let result = resolve_lanes(&exclusive_board(), &occupancy);

    assert!(result.disabled.is_empty());
    assert!(result.diagnostics.is_empty());
}

#[test]
fn empty_m2_selects_the_empty_mode() {
    let result = resolve_lanes(
        &exclusive_board(),
        &installed(&[("SATA_5", Protocol::Sata)]),
    );

    assert!(result.disabled.is_empty());
    assert!(result.diagnostics.is_empty());
}

#[test]
fn protocol_condition_does_not_hold_for_an_empty_socket() {
    let board = Board::from_toml(&format!("{HEADER}{PROTOCOL_MODES}{SOCKETS}"))
        .expect("fixture board must parse");

    let result = resolve_lanes(&board, &installed(&[]));

    assert_eq!(
        result.diagnostics,
        vec![Diagnostic::NoMatchingMode {
            mux: "mux_m2_sata_exclusive".into(),
        }]
    );
}

#[test]
fn condition_with_both_state_and_protocol_is_rejected() {
    let modes = EMPTY_MODE.replace(r#"is = "empty" }"#, r#"is = "empty", protocol = "pcie" }"#);

    assert!(Board::from_toml(&format!("{HEADER}{modes}{SOCKETS}")).is_err());
}

#[test]
fn unknown_protocol_is_rejected() {
    let modes = PROTOCOL_MODES.replace(r#"protocol = "sata""#, r#"protocol = "scsi""#);

    assert!(Board::from_toml(&format!("{HEADER}{EMPTY_MODE}{modes}{SOCKETS}")).is_err());
}

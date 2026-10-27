use std::collections::BTreeMap;

use mblint_core::board::Board;
use mblint_core::device::Device;
use mblint_core::evaluate::{PassOutcome, evaluate};
use mblint_core::physical::{self, check_physical};
use mblint_core::protocol::Protocol;
use mblint_core::rig::{LoadedRig, Rig};
use mblint_core::tunnels::{Diagnostic, resolve_tunnels};

const BOARD: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Display Board"

[nodes.root_usb]
type = "root"
bus = "usb"
lanes = 4
generation = 4

[nodes.PORT_TYPEC_1]
type = "socket"
category = "usb_c"
parent = "root_usb"
supported_protocols = ["usb4", "dp_alt_mode"]
dp_alt_max_lanes = 4

[nodes.PORT_TYPEC_2]
type = "socket"
category = "usb_c"
parent = "root_usb"
dp_alt_max_lanes = 2

[nodes.PORT_TYPEC_3]
type = "socket"
category = "usb_c"
parent = "root_usb"

[nodes.PORT_USBA_1]
type = "socket"
category = "usb_a"
parent = "root_usb"
"#;

const MONITOR_4_LANES: &str = r#"
schema_version = "2.0.0"
id = "monitor_4k"
name = "Test 4K Monitor"
type = "display"

[display]
resolution = "3840x2160"
refresh_rate = 60
dsc_supported = false
required_dp_lanes = 4
bandwidth_requirement_gbps = 12.54
"#;

fn monitor_with_lanes(lanes: u8) -> String {
    MONITOR_4_LANES.replace(
        "required_dp_lanes = 4",
        &format!("required_dp_lanes = {lanes}"),
    )
}

fn board() -> Board {
    Board::from_toml(BOARD).expect("fixture board must parse")
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

fn pass_3(devices: &[(&str, &str)]) -> Vec<Diagnostic> {
    resolve_tunnels(&board(), &installed(devices)).diagnostics
}

#[test]
fn display_fits_a_type_c_port() {
    let devices = installed(&[("PORT_TYPEC_1", MONITOR_4_LANES)]);

    assert!(check_physical(&board(), &devices).is_empty());
}

#[test]
fn display_does_not_fit_a_type_a_port() {
    let devices = installed(&[("PORT_USBA_1", MONITOR_4_LANES)]);

    assert_eq!(
        check_physical(&board(), &devices),
        vec![physical::Diagnostic::WrongSocketCategory {
            socket: "PORT_USBA_1".into(),
        }]
    );
}

#[test]
fn display_runs_displayport() {
    let monitor = Device::from_toml(MONITOR_4_LANES).expect("fixture device must parse");

    assert_eq!(monitor.protocol(), Protocol::Displayport);
}

#[test]
fn display_taking_four_lanes_limits_the_port_to_usb_2() {
    assert_eq!(
        pass_3(&[("PORT_TYPEC_1", MONITOR_4_LANES)]),
        vec![Diagnostic::UsbLimitedToUsb2 {
            socket: "PORT_TYPEC_1".into(),
        }]
    );
}

#[test]
fn display_taking_two_lanes_leaves_usb_3_data() {
    assert!(pass_3(&[("PORT_TYPEC_1", &monitor_with_lanes(2))]).is_empty());
}

#[test]
fn display_needing_more_lanes_than_the_port_drives_is_an_error() {
    let diagnostics = pass_3(&[("PORT_TYPEC_2", MONITOR_4_LANES)]);

    assert_eq!(
        diagnostics,
        vec![Diagnostic::DpLanesInsufficient {
            socket: "PORT_TYPEC_2".into(),
            required: 4,
            available: 2,
        }]
    );
    assert!(diagnostics[0].is_error());
}

#[test]
fn display_in_a_port_without_dp_alt_mode_is_an_error() {
    let diagnostics = pass_3(&[("PORT_TYPEC_3", MONITOR_4_LANES)]);

    assert_eq!(
        diagnostics,
        vec![Diagnostic::DpAltModeUnsupported {
            socket: "PORT_TYPEC_3".into(),
        }]
    );
    assert!(diagnostics[0].is_error());
}

#[test]
fn usb_2_limit_is_a_warning() {
    let diagnostics = pass_3(&[("PORT_TYPEC_1", MONITOR_4_LANES)]);

    assert!(!diagnostics[0].is_error());
}

fn loaded_rig(devices: &[(&str, &str)]) -> LoadedRig {
    LoadedRig {
        rig: Rig {
            schema_version: "2.0.0".into(),
            name: "Test Rig".into(),
            board: "boards/test/display_board.toml".into(),
            bindings: BTreeMap::new(),
        },
        board: board(),
        installed: installed(devices),
    }
}

#[test]
fn pass_3_error_stops_pass_4() {
    let evaluation = evaluate(&loaded_rig(&[("PORT_TYPEC_3", MONITOR_4_LANES)]));

    assert!(matches!(evaluation.tunnels, PassOutcome::Ran(_)));
    assert_eq!(evaluation.throughput, PassOutcome::NotRun);
    assert_eq!(evaluation.iommu, PassOutcome::NotRun);
}

#[test]
fn pass_3_warning_lets_pass_4_run() {
    let evaluation = evaluate(&loaded_rig(&[("PORT_TYPEC_1", MONITOR_4_LANES)]));

    assert!(matches!(evaluation.throughput, PassOutcome::Ran(_)));
    assert!(matches!(evaluation.iommu, PassOutcome::Ran(_)));
}

use mblint_core::board::Board;
use mblint_core::lanes::{Diagnostic, resolve_lanes};
use mblint_core::occupancy::Occupancy;
use mblint_core::protocol::Protocol;

const PEG_HEADER: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Bifurcation Board"

[nodes.root_cpu_peg]
type = "root"
bus = "pcie"
lanes = 16
generation = 5

[nodes.mux_peg_bifurcation]
type = "mux"
subtype = "bifurcation"
parent = "root_cpu_peg"

[[nodes.mux_peg_bifurcation.modes]]
when = { socket = "PCI_E2", is = "empty" }
allocate = { PCI_E1 = 16 }

[[nodes.mux_peg_bifurcation.modes]]
when = { socket = "PCI_E2", is = "occupied" }
allocate = { PCI_E1 = 8, PCI_E2 = 8 }

[nodes.PCI_E1]
type = "socket"
category = "pcie_slot"
parent = "mux_peg_bifurcation"

[nodes.PCI_E2]
type = "socket"
category = "pcie_slot"
parent = "mux_peg_bifurcation"
"#;

const USB4_BRIDGE: &str = r#"
[nodes.bridge_asm4242_usb4]
type = "bridge"
parent = "{parent}"
upstream_bus = "pcie"
upstream_lanes = 4
upstream_generation = 4
downstream_bus = "usb4"
max_throughput_gbps = 40.0
"#;

const CPU_GPP_ROOT: &str = r#"
[nodes.root_cpu_gpp]
type = "root"
bus = "pcie"
lanes = 4
generation = 4
"#;

fn board(toml: &str) -> Board {
    Board::from_toml(toml).expect("fixture board must parse")
}

fn occupied(sockets: &[&str]) -> Occupancy {
    let mut occupancy = Occupancy::default();
    for socket in sockets {
        occupancy.install(*socket, Protocol::Pcie);
    }
    occupancy
}

fn bridge_under(parent: &str) -> String {
    USB4_BRIDGE.replace("{parent}", parent)
}

#[test]
fn pci_e1_gets_all_16_lanes_when_pci_e2_is_empty() {
    let board = board(PEG_HEADER);

    let result = resolve_lanes(&board, &occupied(&["PCI_E1"]));

    assert_eq!(result.allocations.get("PCI_E1"), Some(&16));
    assert_eq!(result.allocations.get("PCI_E2"), None);
    assert!(result.diagnostics.is_empty());
}

#[test]
fn lanes_split_x8_x8_when_pci_e2_is_occupied() {
    let board = board(PEG_HEADER);

    let result = resolve_lanes(&board, &occupied(&["PCI_E1", "PCI_E2"]));

    assert_eq!(result.allocations.get("PCI_E1"), Some(&8));
    assert_eq!(result.allocations.get("PCI_E2"), Some(&8));
    assert!(result.diagnostics.is_empty());
}

#[test]
fn bridge_sharing_the_peg_root_overcommits_its_lanes() {
    let board = board(&format!("{PEG_HEADER}{}", bridge_under("root_cpu_peg")));

    let result = resolve_lanes(&board, &occupied(&["PCI_E1"]));

    assert_eq!(
        result.diagnostics,
        vec![Diagnostic::LaneOvercommit {
            root: "root_cpu_peg".into(),
            supplied: 16,
            demanded: 20,
        }]
    );
}

#[test]
fn bridge_on_its_own_root_does_not_overcommit() {
    let board = board(&format!(
        "{PEG_HEADER}{CPU_GPP_ROOT}{}",
        bridge_under("root_cpu_gpp")
    ));

    let result = resolve_lanes(&board, &occupied(&["PCI_E1"]));

    assert!(result.diagnostics.is_empty());
}

#[test]
fn mux_without_a_matching_mode_is_reported() {
    let toml = PEG_HEADER.replace(
        r#"when = { socket = "PCI_E2", is = "empty" }"#,
        r#"when = { socket = "PCI_E2", is = "occupied" }"#,
    );
    let board = board(&toml);

    let result = resolve_lanes(&board, &occupied(&[]));

    assert_eq!(
        result.diagnostics,
        vec![Diagnostic::NoMatchingMode {
            mux: "mux_peg_bifurcation".into(),
        }]
    );
    assert!(result.allocations.is_empty());
}

#[test]
fn unknown_socket_state_is_rejected_at_parse_time() {
    let toml = PEG_HEADER.replace(r#"is = "empty""#, r#"is = "half_full""#);

    assert!(Board::from_toml(&toml).is_err());
}

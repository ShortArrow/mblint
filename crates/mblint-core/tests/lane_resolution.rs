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
slot_index = 2
physical_form_factor = "x16"

[nodes.PCI_E2]
type = "socket"
category = "pcie_slot"
parent = "mux_peg_bifurcation"
slot_index = 4
physical_form_factor = "x16"
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

fn slot_under_gpp(id: &str, lanes: &str) -> String {
    format!(
        r#"
[nodes.{id}]
type = "socket"
category = "m2_slot"
parent = "root_cpu_gpp"
key = "M"
{lanes}
"#
    )
}

#[test]
fn empty_slots_wired_to_a_root_overcommit_it() {
    let board = board(&format!(
        "{PEG_HEADER}{CPU_GPP_ROOT}{}{}",
        slot_under_gpp("M2_1", "max_lanes = 4"),
        slot_under_gpp("M2_2", "max_lanes = 4"),
    ));

    let result = resolve_lanes(&board, &occupied(&[]));

    assert_eq!(
        result.diagnostics,
        vec![Diagnostic::LaneOvercommit {
            root: "root_cpu_gpp".into(),
            supplied: 4,
            demanded: 8,
        }]
    );
}

#[test]
fn slot_without_stated_lanes_and_sata_port_draw_nothing_from_a_root() {
    let board = board(&format!(
        r#"{PEG_HEADER}{CPU_GPP_ROOT}{}{}
[nodes.SATA_1]
type = "socket"
category = "sata_port"
parent = "root_cpu_gpp"
"#,
        slot_under_gpp("M2_1", "max_lanes = 4"),
        slot_under_gpp("M2_2", ""),
    ));

    let result = resolve_lanes(&board, &occupied(&["M2_1", "M2_2", "SATA_1"]));

    assert_eq!(result.demanded.get("root_cpu_gpp"), Some(&4));
    assert!(result.diagnostics.is_empty());
}

fn sata_module_in_m2_1() -> Occupancy {
    let mut occupancy = Occupancy::default();
    occupancy.install("M2_1", Protocol::Sata);
    occupancy
}

fn gpp_board(protocols: &str) -> Board {
    board(&format!(
        "{PEG_HEADER}{CPU_GPP_ROOT}{}",
        slot_under_gpp("M2_1", &format!("max_lanes = 4\n{protocols}"))
    ))
}

#[test]
fn sata_module_in_a_pcie_only_slot_is_unsupported() {
    let board = gpp_board(r#"supported_protocols = ["pcie"]"#);

    let result = resolve_lanes(&board, &sata_module_in_m2_1());

    assert_eq!(
        result.diagnostics,
        vec![Diagnostic::ProtocolUnsupported {
            socket: "M2_1".into(),
            protocol: Protocol::Sata,
        }]
    );
}

#[test]
fn slot_listing_the_module_protocol_or_none_accepts_it() {
    for protocols in [r#"supported_protocols = ["pcie", "sata"]"#, ""] {
        let board = gpp_board(protocols);

        let result = resolve_lanes(&board, &sata_module_in_m2_1());

        assert!(result.diagnostics.is_empty(), "{protocols}");
    }
}

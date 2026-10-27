use mblint_core::board::Board;
use mblint_core::lanes::resolve_lanes;
use mblint_core::occupancy::Occupancy;
use mblint_core::protocol::Protocol;

const BOARD: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Shared USB4 Board"

[nodes.root_cpu_gpp]
type = "root"
bus = "pcie"
lanes = 4
generation = 5

[nodes.mux_m2_usb4]
type = "mux"
subtype = "bifurcation"
parent = "root_cpu_gpp"

[[nodes.mux_m2_usb4.modes]]
when = { socket = "M2_2", is = "empty" }
allocate = { bridge_usb4 = 4 }

[[nodes.mux_m2_usb4.modes]]
when = { socket = "M2_2", is = "occupied" }
allocate = { M2_2 = 2, bridge_usb4 = 2 }

[nodes.bridge_usb4]
type = "bridge"
parent = "mux_m2_usb4"
upstream_lanes = 4

[nodes.M2_2]
type = "socket"
category = "m2_slot"
parent = "mux_m2_usb4"
key = "M"
max_lanes = 4
"#;

fn board() -> Board {
    Board::from_toml(BOARD).expect("fixture board must parse")
}

#[test]
fn bridge_under_a_mux_gets_every_lane_while_the_shared_slot_is_empty() {
    let result = resolve_lanes(&board(), &Occupancy::default());

    assert_eq!(result.allocations.get("bridge_usb4"), Some(&4));
    assert!(result.diagnostics.is_empty());
}

#[test]
fn bridge_under_a_mux_shares_the_lanes_with_an_occupied_slot() {
    let mut occupancy = Occupancy::default();
    occupancy.install("M2_2", Protocol::Pcie);

    let result = resolve_lanes(&board(), &occupancy);

    assert_eq!(result.allocations.get("M2_2"), Some(&2));
    assert_eq!(result.allocations.get("bridge_usb4"), Some(&2));
    assert!(result.diagnostics.is_empty());
}

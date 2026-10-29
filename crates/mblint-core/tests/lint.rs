//! Lint checks a board on its own, as `docs/spec/lint.md` specifies.

use std::collections::BTreeMap;

use mblint_core::board::Board;
use mblint_core::lint::{Diagnostic, Occupant, lint};
use mblint_core::protocol::Protocol;

const REFERENCE_BOARDS: [(&str, &str); 8] = [
    (
        "msi/mag_x870e_tomahawk_wifi",
        include_str!("../../../data/boards/msi/mag_x870e_tomahawk_wifi.toml"),
    ),
    (
        "msi/mag_z890_tomahawk_wifi",
        include_str!("../../../data/boards/msi/mag_z890_tomahawk_wifi.toml"),
    ),
    (
        "asus/proart_x870e_creator_wifi",
        include_str!("../../../data/boards/asus/proart_x870e_creator_wifi.toml"),
    ),
    (
        "asus/rog_strix_z890_f_gaming_wifi",
        include_str!("../../../data/boards/asus/rog_strix_z890_f_gaming_wifi.toml"),
    ),
    (
        "gigabyte/b850m_d3hp",
        include_str!("../../../data/boards/gigabyte/b850m_d3hp.toml"),
    ),
    (
        "gigabyte/z890_aero_g",
        include_str!("../../../data/boards/gigabyte/z890_aero_g.toml"),
    ),
    (
        "asrock/x870_taichi_creator",
        include_str!("../../../data/boards/asrock/x870_taichi_creator.toml"),
    ),
    (
        "asrock/z890_steel_legend_wifi",
        include_str!("../../../data/boards/asrock/z890_steel_legend_wifi.toml"),
    ),
];

fn board(nodes: &str) -> Board {
    let source = format!(
        r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Lint Board"

[nodes.root_cpu]
type = "root"
bus = "pcie"
lanes = 16
generation = 5

{nodes}
"#
    );
    Board::from_toml(&source).expect("test board must parse")
}

fn slot(id: &str, parent: &str) -> String {
    format!(
        r#"
[nodes."{id}"]
type = "socket"
category = "pcie_slot"
parent = "{parent}"
slot_index = 1
physical_form_factor = "x16"
"#
    )
}

fn bridge(id: &str, parent: &str) -> String {
    format!(
        r#"
[nodes."{id}"]
type = "bridge"
parent = "{parent}"
upstream_lanes = 4
"#
    )
}

fn mux(id: &str, modes: &[(&str, &str)]) -> String {
    let modes: String = modes
        .iter()
        .map(|(when, rest)| format!("\n[[nodes.{id}.modes]]\nwhen = {when}\n{rest}\n"))
        .collect();
    format!(
        "\n[nodes.{id}]\ntype = \"mux\"\nsubtype = \"bifurcation\"\nparent = \"root_cpu\"\n{modes}"
    )
}

fn occupancy(states: &[(&str, Occupant)]) -> BTreeMap<String, Occupant> {
    states
        .iter()
        .map(|(socket, state)| (socket.to_string(), *state))
        .collect()
}

#[test]
fn reference_boards_pass_lint() {
    for (name, source) in REFERENCE_BOARDS {
        let board = Board::from_toml(source).expect("reference board must parse");

        assert_eq!(lint(&board), vec![], "{name}");
    }
}

#[test]
fn node_id_with_a_dot_or_named_unknown_is_invalid() {
    let board = board(&(slot("A.B", "root_cpu") + &slot("unknown", "root_cpu")));

    assert_eq!(
        lint(&board),
        vec![
            Diagnostic::InvalidNodeId { node: "A.B".into() },
            Diagnostic::InvalidNodeId {
                node: "unknown".into()
            },
        ]
    );
}

#[test]
fn parent_naming_no_node_is_unknown() {
    let board = board(&slot("PCIE1", "root_gpu"));

    assert_eq!(
        lint(&board),
        vec![Diagnostic::UnknownParent {
            node: "PCIE1".into(),
            parent: "root_gpu".into()
        }]
    );
}

#[test]
fn usb_port_of_unknown_upstream_passes() {
    let board = board(
        r#"
[nodes.C1]
type = "socket"
category = "usb_c"
parent = "unknown"
"#,
    );

    assert_eq!(lint(&board), vec![]);
}

#[test]
fn parent_that_supplies_no_lanes_is_invalid() {
    let board = board(
        &(slot("PCIE1", "root_cpu")
            + &slot("PCIE2", "PCIE1")
            + r#"
[nodes.sata_controller]
type = "controller"
iommu_group = 3
"# + &bridge("bridge_hub", "sata_controller")),
    );

    assert_eq!(
        lint(&board),
        vec![
            Diagnostic::InvalidParent {
                node: "PCIE2".into(),
                parent: "PCIE1".into()
            },
            Diagnostic::InvalidParent {
                node: "bridge_hub".into(),
                parent: "sata_controller".into()
            },
        ]
    );
}

#[test]
fn cycle_is_reported_once_from_its_smallest_id() {
    let board = board(
        &(bridge("bridge_b", "bridge_c")
            + &bridge("bridge_c", "bridge_a")
            + &bridge("bridge_a", "bridge_b")
            + &slot("PCIE1", "bridge_a")),
    );

    assert_eq!(
        lint(&board),
        vec![Diagnostic::ParentCycle {
            nodes: vec!["bridge_a".into(), "bridge_b".into(), "bridge_c".into()]
        }]
    );
}

#[test]
fn mode_naming_a_missing_or_wrong_node_is_reported() {
    let board = board(
        &(mux(
            "mux_x16",
            &[
                (
                    r#"{ socket = "PCIE9", is = "occupied" }"#,
                    r#"allocate = { PCIE1 = 8 }"#,
                ),
                (
                    r#"{ socket = "PCIE9", is = "empty" }"#,
                    r#"allocate = { PCIE1 = 8, root_cpu = 1 }
disables = ["bridge_hub"]"#,
                ),
            ],
        ) + &slot("PCIE1", "mux_x16")
            + &bridge("bridge_hub", "root_cpu")),
    );

    assert_eq!(
        lint(&board),
        vec![
            Diagnostic::UnknownModeTarget {
                mux: "mux_x16".into(),
                node: "PCIE9".into()
            },
            Diagnostic::UnknownModeTarget {
                mux: "mux_x16".into(),
                node: "bridge_hub".into()
            },
            Diagnostic::UnknownModeTarget {
                mux: "mux_x16".into(),
                node: "root_cpu".into()
            },
        ]
    );
}

#[test]
fn allocation_to_a_node_of_another_parent_is_foreign() {
    let board = board(
        &(mux(
            "mux_x16",
            &[
                (
                    r#"{ socket = "PCIE2", is = "occupied" }"#,
                    r#"allocate = { PCIE1 = 8, PCIE2 = 8 }"#,
                ),
                (
                    r#"{ socket = "PCIE2", is = "empty" }"#,
                    r#"allocate = { PCIE1 = 16 }"#,
                ),
            ],
        ) + &slot("PCIE1", "mux_x16")
            + &slot("PCIE2", "root_cpu")),
    );

    assert_eq!(
        lint(&board),
        vec![Diagnostic::ForeignAllocation {
            mux: "mux_x16".into(),
            node: "PCIE2".into()
        }]
    );
}

#[test]
fn node_under_a_mux_that_no_mode_allocates_is_unreachable() {
    let board = board(
        &(mux(
            "mux_x16",
            &[
                (
                    r#"{ socket = "PCIE1", is = "occupied" }"#,
                    r#"allocate = { PCIE1 = 16 }"#,
                ),
                (
                    r#"{ socket = "PCIE1", is = "empty" }"#,
                    r#"disables = ["PCIE2"]"#,
                ),
            ],
        ) + &slot("PCIE1", "mux_x16")
            + &slot("PCIE2", "mux_x16")),
    );

    assert_eq!(
        lint(&board),
        vec![Diagnostic::UnreachableSocket {
            node: "PCIE2".into()
        }]
    );
}

#[test]
fn mux_without_a_mode_for_some_state_reports_the_first_such_occupancy() {
    let board = board(
        &(mux(
            "mux_x16",
            &[(
                r#"{ socket = "PCIE2", is = "occupied" }"#,
                r#"allocate = { PCIE1 = 8, PCIE2 = 8 }"#,
            )],
        ) + &slot("PCIE1", "mux_x16")
            + &slot("PCIE2", "mux_x16")),
    );

    assert_eq!(
        lint(&board),
        vec![Diagnostic::NoMatchingMode {
            mux: "mux_x16".into(),
            occupancy: occupancy(&[("PCIE2", Occupant::Empty)]),
        }]
    );
}

#[test]
fn protocol_conditions_leave_other_protocols_to_cover() {
    let board = board(
        &(mux(
            "mux_m2",
            &[
                (
                    r#"{ socket = "M2_1", protocol = "pcie" }"#,
                    r#"allocate = { M2_1 = 4 }"#,
                ),
                (
                    r#"{ socket = "M2_1", is = "empty" }"#,
                    r#"allocate = { M2_1 = 4 }"#,
                ),
            ],
        ) + r#"
[nodes.M2_1]
type = "socket"
category = "m2_slot"
parent = "mux_m2"
key = "M"
"#),
    );

    assert_eq!(
        lint(&board),
        vec![Diagnostic::NoMatchingMode {
            mux: "mux_m2".into(),
            occupancy: occupancy(&[("M2_1", Occupant::Running(Protocol::Sata))]),
        }]
    );
}

#[test]
fn root_overcommitted_under_some_occupancy_reports_the_greatest_demand() {
    let modes = |socket: &str, lanes: u32| {
        [
            (
                format!(r#"{{ socket = "{socket}", is = "occupied" }}"#),
                format!("allocate = {{ {socket} = {lanes} }}"),
            ),
            (
                format!(r#"{{ socket = "{socket}", is = "empty" }}"#),
                String::new(),
            ),
        ]
    };
    let mux_of = |id: &str, socket: &str, lanes: u32| {
        let modes = modes(socket, lanes);
        let modes: Vec<(&str, &str)> = modes
            .iter()
            .map(|(when, rest)| (when.as_str(), rest.as_str()))
            .collect();
        mux(id, &modes)
    };
    let board = board(
        &(mux_of("mux_a", "PCIE1", 16)
            + &slot("PCIE1", "mux_a")
            + &mux_of("mux_b", "PCIE2", 8)
            + &slot("PCIE2", "mux_b")),
    );

    assert_eq!(
        lint(&board),
        vec![Diagnostic::LaneOvercommit {
            root: "root_cpu".into(),
            supplied: 16,
            demanded: 24,
            occupancy: occupancy(&[
                ("PCIE1", Occupant::Running(Protocol::Pcie)),
                ("PCIE2", Occupant::Running(Protocol::Pcie)),
            ]),
        }]
    );
}

#[test]
fn muxes_that_cannot_take_their_largest_modes_together_do_not_overcommit() {
    let board = board(
        &(mux(
            "mux_a",
            &[
                (
                    r#"{ socket = "PCIE1", is = "occupied" }"#,
                    r#"allocate = { PCIE1 = 16 }"#,
                ),
                (r#"{ socket = "PCIE1", is = "empty" }"#, ""),
            ],
        ) + &slot("PCIE1", "mux_a")
            + &mux(
                "mux_b",
                &[
                    (
                        r#"{ socket = "PCIE1", is = "empty" }"#,
                        r#"allocate = { PCIE2 = 16 }"#,
                    ),
                    (r#"{ socket = "PCIE1", is = "occupied" }"#, ""),
                ],
            )
            + &slot("PCIE2", "mux_b")),
    );

    assert_eq!(lint(&board), vec![]);
}

#[test]
fn diagnostics_are_grouped_by_kind_in_the_order_of_the_spec() {
    let board = board(
        &(mux(
            "mux_x16",
            &[(
                r#"{ socket = "PCIE1", is = "occupied" }"#,
                r#"allocate = { PCIE1 = 16 }"#,
            )],
        ) + &slot("PCIE1", "mux_x16")
            + &slot("PCIE2", "root_gpu")),
    );

    assert_eq!(
        lint(&board),
        vec![
            Diagnostic::UnknownParent {
                node: "PCIE2".into(),
                parent: "root_gpu".into()
            },
            Diagnostic::NoMatchingMode {
                mux: "mux_x16".into(),
                occupancy: occupancy(&[("PCIE1", Occupant::Empty)]),
            },
        ]
    );
}

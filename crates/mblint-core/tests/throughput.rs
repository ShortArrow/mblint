use std::collections::BTreeMap;

use mblint_core::board::Board;
use mblint_core::device::Device;
use mblint_core::evaluate::{PassOutcome, evaluate};
use mblint_core::lanes::resolve_lanes;
use mblint_core::occupancy::Occupancy;
use mblint_core::rig::{LoadedRig, Rig};
use mblint_core::throughput::{Diagnostic, Link, Throughput, rate_links};
use mblint_core::tunnels::{Tunnelling, resolve_tunnels};

const BOARD: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Throughput Board"

[nodes.root_cpu]
type = "root"
bus = "pcie"
lanes = 16
generation = 5

[nodes.root_pch]
type = "root"
bus = "hsio"
lanes = 8
generation = 4

[nodes.mux_peg]
type = "mux"
subtype = "bifurcation"
parent = "root_cpu"

[[nodes.mux_peg.modes]]
when = { socket = "PCI_E2", is = "empty" }
allocate = { PCI_E1 = 16 }

[[nodes.mux_peg.modes]]
when = { socket = "PCI_E2", is = "occupied" }
allocate = { PCI_E1 = 8, PCI_E2 = 8 }

[nodes.PCI_E1]
type = "socket"
category = "pcie_slot"
parent = "mux_peg"
slot_index = 1
physical_form_factor = "x16"

[nodes.PCI_E2]
type = "socket"
category = "pcie_slot"
parent = "mux_peg"
slot_index = 5
physical_form_factor = "x16"

[nodes.M2_1]
type = "socket"
category = "m2_slot"
parent = "root_pch"
key = "M"
max_lanes = 4

[nodes.M2_2]
type = "socket"
category = "m2_slot"
parent = "root_pch"
key = "M"

[nodes.PORT_TYPEC_1]
type = "socket"
category = "usb_c"
parent = "root_cpu"
"#;

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

const SATA_SSD: &str = r#"
schema_version = "2.0.0"
id = "sata_ssd"
name = "Test SATA SSD"
type = "m2_module"

[interface]
protocol = "sata"
generation = 3
lanes = 1

[physical]
keys = ["B", "M"]
form_factor = "2280"
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
max_tunneling_gbps = 31.5

[downstream_sockets.EGPU_SLOT]
category = "pcie_slot"
physical_form_factor = "x16"
max_electrical_lanes = 4
generation = 3
"#;

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

/// Passes 2 to 4 over devices bound to the fixture board.
fn throughput(devices: &[(&str, &str)]) -> Throughput {
    let board = board();
    let installed = installed(devices);
    let mut occupancy = Occupancy::default();
    for (socket, device) in installed.iter().filter(|(path, _)| !path.contains('.')) {
        occupancy.install(socket.clone(), device.protocol());
    }
    let lanes = resolve_lanes(&board, &occupancy);
    let tunnels = resolve_tunnels(&board, &installed);
    rate_links(&board, &installed, &lanes, &tunnels)
}

fn gen3_lane() -> f64 {
    8.0 * 128.0 / 130.0
}

fn gen4_lane() -> f64 {
    16.0 * 128.0 / 130.0
}

fn gen5_lane() -> f64 {
    32.0 * 128.0 / 130.0
}

#[test]
fn card_with_all_lanes_allocated_runs_at_its_own_rate() {
    let result = throughput(&[("PCI_E1", CARD_GEN4_X16)]);

    assert_eq!(
        result.links.get("PCI_E1"),
        Some(&Link {
            generation: 4,
            lanes: 16,
            gbps: gen4_lane() * 16.0,
        })
    );
    assert!(result.diagnostics.is_empty());
}

#[test]
fn bifurcated_slot_is_a_bottleneck() {
    let result = throughput(&[("PCI_E1", CARD_GEN4_X16), ("PCI_E2", CARD_GEN4_X16)]);

    assert_eq!(
        result.diagnostics,
        vec![
            Diagnostic::Bottleneck {
                socket: "PCI_E1".into(),
                required_gbps: gen4_lane() * 16.0,
                actual_gbps: gen4_lane() * 8.0,
            },
            Diagnostic::Bottleneck {
                socket: "PCI_E2".into(),
                required_gbps: gen4_lane() * 16.0,
                actual_gbps: gen4_lane() * 8.0,
            },
        ]
    );
}

#[test]
fn socket_without_a_mux_runs_at_its_max_lanes_and_its_root_generation() {
    let result = throughput(&[("M2_1", SSD_GEN5_X4)]);

    assert_eq!(
        result.links.get("M2_1"),
        Some(&Link {
            generation: 4,
            lanes: 4,
            gbps: gen4_lane() * 4.0,
        })
    );
    assert_eq!(
        result.diagnostics,
        vec![Diagnostic::Bottleneck {
            socket: "M2_1".into(),
            required_gbps: gen5_lane() * 4.0,
            actual_gbps: gen4_lane() * 4.0,
        }]
    );
}

#[test]
fn socket_without_a_lane_count_is_unrated() {
    let result = throughput(&[("M2_2", SSD_GEN5_X4)]);

    assert_eq!(result.links.get("M2_2"), None);
    assert_eq!(
        result.diagnostics,
        vec![Diagnostic::UnratedLink {
            socket: "M2_2".into(),
        }]
    );
}

#[test]
fn generation_without_a_data_rate_is_unrated() {
    let gen6_ssd = SSD_GEN5_X4.replace("generation = 5", "generation = 6");

    let result = throughput(&[("M2_1", &gen6_ssd)]);

    assert_eq!(
        result.diagnostics,
        vec![Diagnostic::UnratedLink {
            socket: "M2_1".into(),
        }]
    );
}

#[test]
fn links_other_than_pcie_are_not_rated() {
    let result = throughput(&[("M2_1", SATA_SSD), ("PORT_TYPEC_1", EGPU_BOX)]);

    assert!(result.links.is_empty());
    assert!(result.diagnostics.is_empty());
}

#[test]
fn adapter_with_a_tunnelling_limit_caps_the_sockets_inside_it() {
    let devices = installed(&[
        ("PORT_TYPEC_1", EGPU_BOX),
        ("PORT_TYPEC_1.EGPU_SLOT", CARD_GEN4_X16),
    ]);

    assert_eq!(
        resolve_tunnels(&board(), &devices),
        Tunnelling {
            caps: BTreeMap::from([("PORT_TYPEC_1.EGPU_SLOT".to_string(), 31.5)]),
            diagnostics: vec![],
        }
    );
}

#[test]
fn adapter_without_a_tunnelling_limit_caps_nothing() {
    let unlimited_box = EGPU_BOX.replace("max_tunneling_gbps = 31.5\n", "");
    let devices = installed(&[
        ("PORT_TYPEC_1", &unlimited_box),
        ("PORT_TYPEC_1.EGPU_SLOT", CARD_GEN4_X16),
    ]);

    assert!(resolve_tunnels(&board(), &devices).caps.is_empty());
}

#[test]
fn card_in_an_egpu_box_is_limited_by_its_slot_and_the_tunnel() {
    let result = throughput(&[
        ("PORT_TYPEC_1", EGPU_BOX),
        ("PORT_TYPEC_1.EGPU_SLOT", CARD_GEN4_X16),
    ]);

    assert_eq!(
        result.links.get("PORT_TYPEC_1.EGPU_SLOT"),
        Some(&Link {
            generation: 3,
            lanes: 4,
            gbps: 31.5_f64.min(gen3_lane() * 4.0),
        })
    );
    assert_eq!(
        result.diagnostics,
        vec![Diagnostic::Bottleneck {
            socket: "PORT_TYPEC_1.EGPU_SLOT".into(),
            required_gbps: gen4_lane() * 16.0,
            actual_gbps: 31.5,
        }]
    );
}

fn loaded_rig(devices: &[(&str, &str)]) -> LoadedRig {
    LoadedRig {
        rig: Rig {
            schema_version: "2.0.0".into(),
            name: "Test Rig".into(),
            board: "boards/test/throughput_board.toml".into(),
            bindings: BTreeMap::new(),
        },
        board: board(),
        installed: installed(devices),
    }
}

#[test]
fn evaluation_runs_passes_3_and_4_after_a_clean_pass_2() {
    let evaluation = evaluate(&loaded_rig(&[("M2_1", SSD_GEN5_X4)]));

    assert!(matches!(evaluation.tunnels, PassOutcome::Ran(_)));
    assert_eq!(evaluation.iommu, PassOutcome::Ran(vec![]));
    assert!(matches!(
        evaluation.throughput,
        PassOutcome::Ran(Throughput { ref diagnostics, .. }) if diagnostics.len() == 1
    ));
}

#[test]
fn pass_2_error_stops_passes_3_and_4() {
    let mut rig = loaded_rig(&[("PCI_E1", CARD_GEN4_X16)]);
    rig.board = Board::from_toml(&BOARD.replace("lanes = 16\n", "lanes = 8\n"))
        .expect("narrowed board must parse");

    let evaluation = evaluate(&rig);

    assert!(
        matches!(evaluation.lanes, PassOutcome::Ran(ref lanes) if !lanes.diagnostics.is_empty())
    );
    assert_eq!(evaluation.tunnels, PassOutcome::NotRun);
    assert_eq!(evaluation.throughput, PassOutcome::NotRun);
    assert_eq!(evaluation.iommu, PassOutcome::NotRun);
}

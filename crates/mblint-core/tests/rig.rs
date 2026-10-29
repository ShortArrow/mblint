use std::collections::BTreeMap;

use mblint_core::evaluate::{PassOutcome, evaluate};
use mblint_core::lanes::Diagnostic as LaneDiagnostic;
use mblint_core::physical::Diagnostic as PhysicalDiagnostic;
use mblint_core::rig::{LoadError, load_rig};

const BOARD: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Rig Board"

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
physical_form_factor = "x4"
"#;

const GPU: &str = r#"
schema_version = "2.0.0"
id = "gpu"
name = "Test GPU"
type = "card"

[interface]
protocol = "pcie"
generation = 4
lanes = 16

[physical]
edge = "x16"
thickness_slots = 2
length_mm = 300
"#;

const NIC: &str = r#"
schema_version = "2.0.0"
id = "nic"
name = "Test NIC"
type = "card"

[interface]
protocol = "pcie"
generation = 3
lanes = 4

[physical]
edge = "x4"
thickness_slots = 1
length_mm = 160
"#;

fn rig(bindings: &str) -> String {
    format!(
        r#"
schema_version = "2.0.0"
name = "Test Rig"
board = "boards/test/rig_board.toml"

[bindings]
{bindings}
"#
    )
}

fn files(rig: &str) -> BTreeMap<&'static str, String> {
    BTreeMap::from([
        ("rigs/test.toml", rig.to_string()),
        ("boards/test/rig_board.toml", BOARD.to_string()),
        ("devices/cards/gpu.toml", GPU.to_string()),
        ("devices/cards/nic.toml", NIC.to_string()),
    ])
}

fn reader(files: &BTreeMap<&'static str, String>) -> impl Fn(&str) -> Result<String, String> {
    |path| {
        files
            .get(path)
            .cloned()
            .ok_or_else(|| format!("{path}: not found"))
    }
}

#[test]
fn rig_is_evaluated_through_pass_2_when_it_fits_physically() {
    let files = files(&rig(r#"
PCI_E1 = "devices/cards/gpu.toml"
PCI_E2 = "devices/cards/nic.toml"
"#));
    let loaded = load_rig("rigs/test.toml", reader(&files)).expect("rig must load");

    let evaluation = evaluate(&loaded);

    assert!(evaluation.physical.is_empty());
    let PassOutcome::Ran(lanes) = evaluation.lanes else {
        panic!("Pass 2 must run when Pass 1 passes");
    };
    assert_eq!(lanes.allocations.get("PCI_E1"), Some(&8));
    assert_eq!(lanes.allocations.get("PCI_E2"), Some(&8));
}

#[test]
fn physical_error_stops_pass_2() {
    let files = files(&rig(r#"PCI_E2 = "devices/cards/gpu.toml""#));
    let loaded = load_rig("rigs/test.toml", reader(&files)).expect("rig must load");

    let evaluation = evaluate(&loaded);

    assert!(matches!(
        evaluation.physical.as_slice(),
        [PhysicalDiagnostic::EdgeTooWide { .. }]
    ));
    assert!(matches!(evaluation.lanes, PassOutcome::NotRun));
}

#[test]
fn pass_2_problems_are_reported_when_pass_1_passes() {
    let board = BOARD.replace("lanes = 16", "lanes = 8");
    let mut files = files(&rig(r#"PCI_E1 = "devices/cards/gpu.toml""#));
    files.insert("boards/test/rig_board.toml", board);
    let loaded = load_rig("rigs/test.toml", reader(&files)).expect("rig must load");

    let PassOutcome::Ran(lanes) = evaluate(&loaded).lanes else {
        panic!("Pass 2 must run when Pass 1 passes");
    };
    assert_eq!(
        lanes.diagnostics,
        vec![LaneDiagnostic::LaneOvercommit {
            root: "root_cpu_peg".into(),
            supplied: 8,
            demanded: 16,
        }]
    );
}

#[test]
fn missing_device_file_is_reported_with_its_path() {
    let files = files(&rig(r#"PCI_E1 = "devices/cards/missing.toml""#));

    let error = load_rig("rigs/test.toml", reader(&files)).unwrap_err();

    assert!(matches!(error, LoadError::Read { path, .. } if path == "devices/cards/missing.toml"));
}

#[test]
fn invalid_device_file_is_reported_with_its_path() {
    let mut files = files(&rig(r#"PCI_E1 = "devices/cards/gpu.toml""#));
    files.insert(
        "devices/cards/gpu.toml",
        GPU.replace(r#"edge = "x16""#, r#"edge = "x32""#),
    );

    let error = load_rig("rigs/test.toml", reader(&files)).unwrap_err();

    assert!(matches!(error, LoadError::Parse { path, .. } if path == "devices/cards/gpu.toml"));
}

#[test]
fn invalid_rig_file_is_reported_with_its_path() {
    let files = files("name = 3");

    let error = load_rig("rigs/test.toml", reader(&files)).unwrap_err();

    assert!(matches!(error, LoadError::Parse { path, .. } if path == "rigs/test.toml"));
}

#[test]
fn paths_that_could_leave_the_data_root_are_refused_before_reading() {
    for path in [
        "../secret.toml",
        "devices/../../secret.toml",
        "/etc/secret.toml",
        "C:/secret.toml",
        "devices\\..\\secret.toml",
        "devices//gpu.toml",
        "./devices/gpu.toml",
    ] {
        let files = files(&rig(&format!("PCI_E1 = {path:?}")));
        let read = |requested: &str| {
            assert_ne!(requested, path, "{path} must not be read");
            reader(&files)(requested)
        };

        let error = load_rig("rigs/test.toml", read).unwrap_err();

        assert!(
            matches!(&error, LoadError::InvalidPath { path: refused } if refused == path),
            "{path}: {error}"
        );
    }
}

#[test]
fn rig_path_itself_follows_the_rule_for_paths() {
    let files = files(&rig(""));

    let error = load_rig("../rigs/test.toml", reader(&files)).unwrap_err();

    assert!(matches!(error, LoadError::InvalidPath { path } if path == "../rigs/test.toml"));
}

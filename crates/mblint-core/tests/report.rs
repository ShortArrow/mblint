//! An evaluation turns into the report that `docs/spec/cli.md` specifies.

use mblint_core::board::Board;
use mblint_core::evaluate::evaluate;
use mblint_core::lint::{Occupant, lint};
use mblint_core::protocol::Protocol;
use mblint_core::report::{Status, lint_report, report};
use mblint_core::rig::load_rig;
use serde_json::{Value, json};

const PRD: &str = include_str!("../../../docs/prd.md");

/// The first code block in `language` after the heading that starts with `heading`.
fn example(heading: &str, language: &str) -> &'static str {
    let after_heading = PRD
        .split_once(&format!("\n{heading}"))
        .unwrap_or_else(|| panic!("PRD has no heading {heading:?}"))
        .1;
    let fence = format!("```{language}\n");
    let block = after_heading
        .split_once(&fence)
        .expect("heading is followed by the code block")
        .1;
    block.split_once("```").expect("code block is closed").0
}

/// Reads the PRD's example files by the paths its rig and the rigs below name.
fn read_prd(path: &str) -> Result<String, String> {
    let heading = match path {
        "rigs/prd.toml" => return Ok(example("### 4.3 ", "toml").to_string()),
        "boards/example/example_x870e.toml" => "### 4.1 ",
        "devices/peripherals/razer_core_x.toml" => "#### Example 1: ",
        "devices/monitors/monitor_4k.toml" => "#### Example 3: ",
        "devices/cards/rtx_4090.toml" | "devices/cards/rtx_3060.toml" => "#### Example 4: ",
        "devices/ssds/crucial_t700.toml" => "#### Example 5: ",
        other => return read_rig(other),
    };
    Ok(example(heading, "toml").to_string())
}

/// Rigs on the PRD's board, written for these tests.
fn read_rig(path: &str) -> Result<String, String> {
    let bindings = match path {
        "rigs/empty.toml" => "",
        "rigs/card_in_m2.toml" => r#"M2_2 = "devices/cards/rtx_4090.toml""#,
        "rigs/monitor.toml" => r#"PORT_TYPEC_1 = "devices/monitors/monitor_4k.toml""#,
        "rigs/card_in_pci_e2.toml" => r#"PCI_E2 = "devices/cards/rtx_4090.toml""#,
        other => return Err(format!("no file {other}")),
    };
    Ok(format!(
        r#"
schema_version = "2.0.0"
name = "Test Rig"
board = "boards/example/example_x870e.toml"

[bindings]
{bindings}
"#
    ))
}

fn json_report(rig: &str) -> Value {
    let loaded = load_rig(rig, read_prd).expect("rig must load");
    serde_json::to_value(report(&evaluate(&loaded))).expect("report must serialize")
}

#[test]
fn report_of_the_prd_rig_is_the_prd_json_example() {
    let expected: Value =
        serde_json::from_str(example("### 6.1 ", "json")).expect("PRD JSON example must parse");

    assert_eq!(json_report("rigs/prd.toml"), expected);
}

#[test]
fn report_without_diagnostics_is_ok() {
    let loaded = load_rig("rigs/empty.toml", read_prd).expect("rig must load");
    let report = report(&evaluate(&loaded));

    assert_eq!(report.status, Status::Ok);
    assert_eq!(
        serde_json::to_value(&report).expect("report must serialize"),
        json!({
            "status": "ok",
            "passes": {
                "physical": "ran",
                "lanes": "ran",
                "tunnels": "ran",
                "throughput": "ran"
            },
            "diagnostics": [],
            "links": {}
        })
    );
}

#[test]
fn physical_error_stops_the_later_passes() {
    let report = json_report("rigs/card_in_m2.toml");

    assert_eq!(report["status"], "error");
    assert_eq!(
        report["passes"],
        json!({
            "physical": "ran",
            "lanes": "not_run",
            "tunnels": "not_run",
            "throughput": "not_run"
        })
    );
    assert_eq!(
        report["diagnostics"],
        json!([{
            "pass": "physical",
            "severity": "error",
            "code": "WRONG_SOCKET_CATEGORY",
            "socket": "M2_2",
            "message": "The device in M2_2 is not made for that category of socket."
        }])
    );
}

#[test]
fn tunnel_warning_names_its_pass() {
    let report = json_report("rigs/monitor.toml");

    assert_eq!(report["status"], "warning");
    assert_eq!(report["diagnostics"][0]["pass"], "tunnels");
    assert_eq!(report["diagnostics"][0]["severity"], "warning");
    assert_eq!(report["diagnostics"][0]["code"], "USB_LIMITED_TO_USB2");
}

#[test]
fn shared_iommu_group_lists_its_endpoints() {
    let report = json_report("rigs/card_in_pci_e2.toml");
    let shared = report["diagnostics"]
        .as_array()
        .expect("diagnostics is an array")
        .iter()
        .find(|diagnostic| diagnostic["code"] == "SHARED_IOMMU_GROUP")
        .expect("the group is reported");

    assert_eq!(
        shared,
        &json!({
            "pass": "throughput",
            "severity": "warning",
            "code": "SHARED_IOMMU_GROUP",
            "group": 14,
            "endpoints": ["ONBOARD_SATA_CONTROLLER", "PCI_E2"],
            "message": "IOMMU group 14 is shared by ONBOARD_SATA_CONTROLLER, PCI_E2."
        })
    );
}

#[test]
fn lint_report_lists_each_diagnostic_as_an_error() {
    let board = Board::from_toml(
        r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Lint Board"

[nodes.PCIE1]
type = "socket"
category = "pcie_slot"
parent = "root_gpu"
slot_index = 1
physical_form_factor = "x16"
"#,
    )
    .expect("board must parse");

    assert_eq!(
        serde_json::to_value(lint_report(&lint(&board))).expect("report must serialize"),
        json!({
            "status": "error",
            "diagnostics": [{
                "severity": "error",
                "code": "UNKNOWN_PARENT",
                "node": "PCIE1",
                "parent": "root_gpu",
                "message": "The parent of PCIE1, root_gpu, names no node."
            }]
        })
    );
}

#[test]
fn lint_report_writes_an_occupancy_as_states_by_socket() {
    let board = Board::from_toml(
        r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Lint Board"

[nodes.root_cpu]
type = "root"
bus = "pcie"
lanes = 4
generation = 4

[nodes.mux_m2]
type = "mux"
subtype = "exclusive"
parent = "root_cpu"

[[nodes.mux_m2.modes]]
when = { socket = "M2_1", protocol = "sata" }
allocate = { M2_1 = 8 }

[[nodes.mux_m2.modes]]
when = { socket = "M2_1", is = "empty" }

[[nodes.mux_m2.modes]]
when = { socket = "M2_1", is = "occupied" }
allocate = { M2_1 = 4 }

[nodes.M2_1]
type = "socket"
category = "m2_slot"
parent = "mux_m2"
key = "M"
"#,
    )
    .expect("board must parse");

    let report = serde_json::to_value(lint_report(&lint(&board))).expect("report must serialize");

    assert_eq!(report["diagnostics"][0]["code"], "LANE_OVERCOMMIT");
    assert_eq!(
        report["diagnostics"][0]["occupancy"],
        json!({ "M2_1": "sata" })
    );
}

#[test]
fn lint_report_without_diagnostics_is_ok() {
    assert_eq!(
        serde_json::to_value(lint_report(&[])).expect("report must serialize"),
        json!({ "status": "ok", "diagnostics": [] })
    );
}

#[test]
fn occupant_serializes_as_empty_or_its_protocol() {
    assert_eq!(
        serde_json::to_value(Occupant::Empty).unwrap(),
        json!("empty")
    );
    assert_eq!(
        serde_json::to_value(Occupant::Running(Protocol::Usb3Gen1x1)).unwrap(),
        json!("usb3_gen1x1")
    );
}

//! `layout` gives every node of a rig's board with what the installed devices make of it, as
//! `docs/spec/web.md` specifies.

use std::collections::BTreeMap;

use mblint_core::layout::layout;
use mblint_core::rig::load_rig;
use serde_json::{Value, json};

const BOARD: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Layout Board"

[nodes.root_cpu]
type = "root"
bus = "pcie"
lanes = 16
generation = 5

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
disables = ["M2_SHARED"]

[nodes.mux_never]
type = "mux"
subtype = "exclusive"
parent = "root_cpu"

[[nodes.mux_never.modes]]
when = { socket = "SATA1", is = "occupied" }
allocate = {}

[nodes.PCI_E1]
type = "socket"
category = "pcie_slot"
parent = "mux_peg"
slot_index = 2
physical_form_factor = "x16"
generation = 5

[nodes.PCI_E2]
type = "socket"
category = "pcie_slot"
parent = "mux_peg"
slot_index = 4
physical_form_factor = "x16"

[nodes.M2_SHARED]
type = "socket"
category = "m2_slot"
parent = "root_cpu"
key = "M"
supported_protocols = ["pcie"]
max_lanes = 4
generation = 4

[nodes.bridge_usb4]
type = "bridge"
parent = "root_cpu"
upstream_bus = "pcie"
upstream_lanes = 4
upstream_generation = 4
downstream_bus = "usb4"
max_throughput_gbps = 40.0

[nodes.SATA1]
type = "socket"
category = "sata_port"
parent = "root_cpu"

[nodes.ctrl_lan]
type = "controller"
iommu_group = 9
"#;

const CARD: &str = r#"
schema_version = "2.0.0"
id = "card"
name = "Test Card"
type = "card"

[interface]
protocol = "pcie"
generation = 4
lanes = 8

[physical]
edge = "x16"
thickness_slots = 1
length_mm = 163
"#;

/// The layout of a rig on `BOARD` with `bindings`, as JSON.
fn layout_of(bindings: &str) -> Value {
    let rig = format!(
        "schema_version = \"2.0.0\"\nname = \"t\"\nboard = \"boards/b.toml\"\n\n[bindings]\n{bindings}"
    );
    let files = BTreeMap::from([
        ("rigs/r.toml", rig),
        ("boards/b.toml", BOARD.to_string()),
        ("devices/card.toml", CARD.to_string()),
    ]);
    let loaded = load_rig("rigs/r.toml", |path| {
        files.get(path).cloned().ok_or_else(|| "absent".to_string())
    })
    .expect("rig loads");
    serde_json::to_value(layout(&loaded)).unwrap()
}

const BOTH_SLOTS: &str = "PCI_E1 = \"devices/card.toml\"\nPCI_E2 = \"devices/card.toml\"\n";

#[test]
fn root_supplies_its_lanes_against_what_its_children_demand() {
    assert_eq!(
        layout_of(BOTH_SLOTS)["root_cpu"],
        json!({ "kind": "root", "parent": null, "generation": 5, "supplied": 16, "demanded": 20 })
    );
}

#[test]
fn mux_gives_the_position_of_its_selected_mode() {
    assert_eq!(layout_of("")["mux_peg"]["mode"], 0);
    assert_eq!(layout_of(BOTH_SLOTS)["mux_peg"]["mode"], 1);
    assert_eq!(layout_of(BOTH_SLOTS)["mux_peg"]["parent"], "root_cpu");
}

#[test]
fn mux_with_no_mode_that_holds_has_a_null_mode() {
    assert_eq!(layout_of("")["mux_never"]["mode"], Value::Null);
}

#[test]
fn occupied_slot_offers_its_allocation_and_needs_the_device_link() {
    assert_eq!(
        layout_of(BOTH_SLOTS)["PCI_E1"],
        json!({
            "kind": "socket",
            "parent": "mux_peg",
            "category": "pcie_slot",
            "slot_index": 2,
            "device": "devices/card.toml",
            "disabled": false,
            "offers": { "generation": 5, "lanes": 8 },
            "needs": { "generation": 4, "lanes": 8 }
        })
    );
}

#[test]
fn empty_socket_still_offers_what_it_can() {
    let layout = layout_of("");

    assert_eq!(
        layout["PCI_E1"]["offers"],
        json!({ "generation": 5, "lanes": 16 })
    );
    assert_eq!(layout["PCI_E1"]["device"], Value::Null);
    assert_eq!(layout["PCI_E1"]["needs"], Value::Null);
    assert_eq!(
        layout["M2_SHARED"]["offers"],
        json!({ "generation": 4, "lanes": 4 })
    );
    assert_eq!(layout["M2_SHARED"]["slot_index"], Value::Null);
}

#[test]
fn socket_a_selected_mode_disables_is_disabled() {
    assert_eq!(layout_of("")["M2_SHARED"]["disabled"], false);
    assert_eq!(layout_of(BOTH_SLOTS)["M2_SHARED"]["disabled"], true);
}

#[test]
fn socket_that_states_no_lane_count_offers_nothing() {
    assert_eq!(layout_of("")["SATA1"]["offers"], Value::Null);
}

#[test]
fn bridge_demands_its_upstream_lanes_and_controller_has_no_parent() {
    let layout = layout_of("");

    assert_eq!(
        layout["bridge_usb4"],
        json!({ "kind": "bridge", "parent": "root_cpu", "lanes": 4 })
    );
    assert_eq!(
        layout["ctrl_lan"],
        json!({ "kind": "controller", "parent": null })
    );
}

#[test]
fn rig_with_a_physical_error_is_still_laid_out() {
    let layout = layout_of("M2_SHARED = \"devices/card.toml\"\n");

    assert_eq!(layout["M2_SHARED"]["device"], "devices/card.toml");
    assert_eq!(layout["root_cpu"]["demanded"], 20);
}

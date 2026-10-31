//! `catalog` says what each file is, by its contents, as `docs/spec/web.md` specifies.

use std::collections::BTreeMap;

use mblint_core::catalog::catalog;
use serde_json::{Value, json};

const BOARD: &str = r#"
schema_version = "2.0.0"
vendor = "Test"
model = "Catalog Board"

[nodes.root_cpu]
type = "root"
bus = "pcie"
lanes = 16
generation = 5
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

const M2_MODULE: &str = r#"
schema_version = "2.0.0"
id = "test_ssd"
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
"#;

const USB_SATA: &str = r#"
schema_version = "2.0.0"
id = "usb_sata"
name = "Test USB to SATA Adapter"
type = "adapter"

[upstream]
connector = "type_a"
protocol = "usb3_gen1x1"

[bridge]
translates_to = "sata"
"#;

const MONITOR: &str = r#"
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

const RIG: &str = r#"
schema_version = "2.0.0"
name = "workstation"
board = "boards/test/board.toml"

[bindings]
PCIE1 = "devices/card.toml"
"#;

/// The catalog entry of `source`, filed under an arbitrary path, as JSON.
fn entry(source: &str) -> Value {
    let files = BTreeMap::from([("anywhere.toml".to_string(), source.to_string())]);
    serde_json::to_value(catalog(&files)).unwrap()["anywhere.toml"].clone()
}

#[test]
fn board_is_listed_with_its_vendor_and_model() {
    assert_eq!(
        entry(BOARD),
        json!({ "kind": "board", "vendor": "Test", "model": "Catalog Board" })
    );
}

#[test]
fn card_is_listed_with_its_interface_and_a_pcie_slot() {
    assert_eq!(
        entry(CARD),
        json!({
            "kind": "device",
            "name": "Test Card",
            "type": "card",
            "interface": { "protocol": "pcie", "generation": 4, "lanes": 8 },
            "socket_category": "pcie_slot"
        })
    );
}

#[test]
fn m2_module_goes_in_an_m2_slot() {
    let entry = entry(M2_MODULE);

    assert_eq!(entry["type"], "m2_module");
    assert_eq!(entry["socket_category"], "m2_slot");
    assert_eq!(entry["interface"]["lanes"], 4);
}

#[test]
fn adapter_has_no_interface_and_goes_in_the_socket_of_its_connector() {
    let type_c = entry(EGPU_BOX);
    let type_a = entry(USB_SATA);

    assert_eq!(type_c["type"], "adapter");
    assert_eq!(type_c["interface"], Value::Null);
    assert_eq!(type_c["socket_category"], "usb_c");
    assert_eq!(type_a["socket_category"], "usb_a");
}

#[test]
fn display_has_no_interface_and_goes_in_a_usb_c_port() {
    let entry = entry(MONITOR);

    assert_eq!(entry["type"], "display");
    assert_eq!(entry["interface"], Value::Null);
    assert_eq!(entry["socket_category"], "usb_c");
}

#[test]
fn rig_is_listed_with_its_name_board_and_bindings() {
    assert_eq!(
        entry(RIG),
        json!({
            "kind": "rig",
            "name": "workstation",
            "board": "boards/test/board.toml",
            "bindings": { "PCIE1": "devices/card.toml" }
        })
    );
}

#[test]
fn file_that_is_none_of_them_says_why_not_each() {
    let entry = entry("title = \"notes\"\n");
    let message = entry["message"].as_str().expect("a message");

    assert_eq!(entry["kind"], "invalid");
    assert!(message.contains("not a board: "), "{message}");
    assert!(message.contains("not a device: "), "{message}");
    assert!(message.contains("not a rig: "), "{message}");
}

#[test]
fn kind_comes_from_the_contents_not_the_path() {
    let files = BTreeMap::from([
        (
            "devices/actually_a_board.toml".to_string(),
            BOARD.to_string(),
        ),
        ("boards/actually_a_card.toml".to_string(), CARD.to_string()),
    ]);
    let catalog = serde_json::to_value(catalog(&files)).unwrap();

    assert_eq!(catalog["devices/actually_a_board.toml"]["kind"], "board");
    assert_eq!(catalog["boards/actually_a_card.toml"]["kind"], "device");
}

#[test]
fn every_path_in_files_has_an_entry() {
    let files = BTreeMap::from([
        ("a.toml".to_string(), BOARD.to_string()),
        ("b.toml".to_string(), "not toml".to_string()),
    ]);

    assert_eq!(
        catalog(&files).keys().collect::<Vec<_>>(),
        ["a.toml", "b.toml"]
    );
}

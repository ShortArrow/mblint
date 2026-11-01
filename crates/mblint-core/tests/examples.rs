//! The example devices under `docs/examples/` behave on the reference boards as the README says.

use std::collections::BTreeMap;

use mblint_core::evaluate::evaluate;
use mblint_core::report::report;
use mblint_core::rig::load_rig;
use serde_json::Value;

const SATA_M2_SSD: &str = include_str!("../../../docs/examples/devices/sata-m2-ssd.toml");

const X870_TAICHI_CREATOR: &str =
    include_str!("../../../data/boards/asrock/x870_taichi_creator.toml");

const Z890_STEEL_LEGEND_WIFI: &str =
    include_str!("../../../data/boards/asrock/z890_steel_legend_wifi.toml");

/// The codes of the diagnostics reported for `SATA_M2_SSD` in `socket` of `board`.
fn codes(board: &str, socket: &str) -> Vec<String> {
    let rig = format!(
        "schema_version = \"2.0.0\"\nname = \"t\"\nboard = \"boards/b.toml\"\n\n[bindings]\n{socket} = \"devices/ssd.toml\"\n"
    );
    let files = BTreeMap::from([
        ("rigs/r.toml", rig),
        ("boards/b.toml", board.to_string()),
        ("devices/ssd.toml", SATA_M2_SSD.to_string()),
    ]);
    let loaded = load_rig("rigs/r.toml", |path| {
        files.get(path).cloned().ok_or_else(|| "absent".to_string())
    })
    .expect("rig loads");
    let report = serde_json::to_value(report(&evaluate(&loaded))).unwrap();
    report["diagnostics"]
        .as_array()
        .unwrap()
        .iter()
        .map(|diagnostic| diagnostic["code"].as_str().unwrap().to_string())
        .collect()
}

#[test]
fn sata_m2_ssd_is_unsupported_in_a_pcie_only_slot() {
    assert_eq!(codes(X870_TAICHI_CREATOR, "M2_1"), ["PROTOCOL_UNSUPPORTED"]);
}

#[test]
fn sata_m2_ssd_is_accepted_in_a_slot_that_supports_sata() {
    assert_eq!(codes(Z890_STEEL_LEGEND_WIFI, "M2_3"), Vec::<String>::new());
}

#[test]
fn every_example_device_parses() {
    for entry in std::fs::read_dir("../../docs/examples/devices").unwrap() {
        let path = entry.unwrap().path();
        let source = std::fs::read_to_string(&path).unwrap();
        assert!(
            mblint_core::device::Device::from_toml(&source).is_ok(),
            "{}",
            path.display()
        );
    }
}

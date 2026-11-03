//! Writes the JSON Schemas of the board, device and rig files to `web/src/report/`, from which the
//! page's editor offers keys and values. CI fails when the files committed there differ.
#![cfg(feature = "schemars")]

use std::path::Path;

use mblint_core::board::Board;
use mblint_core::device::Device;
use mblint_core::rig::Rig;
use schemars::{JsonSchema, schema_for};

fn export<T: JsonSchema>(name: &str) {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join(format!("../../web/src/report/{name}.schema.json"));
    let json = serde_json::to_string_pretty(&schema_for!(T)).unwrap();
    std::fs::write(&path, format!("{json}\n")).unwrap();
}

#[test]
fn export_schemas() {
    export::<Board>("board");
    export::<Device>("device");
    export::<Rig>("rig");
}

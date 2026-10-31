//! `check_files` and `lint_files` read only from the given files and return the CLI's reports,
//! as `docs/spec/web.md` specifies.

use std::fs;
use std::path::Path;

use mblint_core::report::Status;
use mblint_core::rig::LoadError;
use mblint_wasm::{Files, check_files, lint_files};

/// Every file under the CLI's test data root, keyed by its data-root-relative path.
fn files() -> Files {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../mblint/tests/data");
    let mut files = Files::new();
    for dir in ["boards/test", "devices", "rigs"] {
        for entry in fs::read_dir(root.join(dir)).expect("data directory exists") {
            let path = entry.expect("directory entry").path();
            let name = path.file_name().unwrap().to_str().unwrap();
            files.insert(
                format!("{dir}/{name}"),
                fs::read_to_string(&path).expect("UTF-8 file"),
            );
        }
    }
    files
}

#[test]
fn rig_reports_as_check_json_does() {
    let report = check_files(&files(), "rigs/warning.toml").expect("rig loads");
    let json = serde_json::to_value(&report).unwrap();

    assert_eq!(json["status"], "warning");
    assert_eq!(json["diagnostics"][0]["code"], "BOTTLENECK");
    assert_eq!(json["links"]["PCIE1"]["lanes"], 4);
}

#[test]
fn rig_with_an_error_reports_error() {
    let report = check_files(&files(), "rigs/error.toml").expect("rig loads");

    assert_eq!(report.status, Status::Error);
}

#[test]
fn path_absent_from_files_fails_naming_it() {
    let error = check_files(&files(), "rigs/missing_device.toml").unwrap_err();

    assert!(matches!(error, LoadError::Read { ref path, .. } if path == "devices/none.toml"));
}

#[test]
fn path_escaping_the_data_root_is_not_read_even_when_present() {
    let mut files = files();
    files.insert(
        "../data/devices/card.toml".into(),
        files["devices/card.toml"].clone(),
    );

    let error = check_files(&files, "rigs/escaping_device.toml").unwrap_err();

    assert!(
        matches!(error, LoadError::InvalidPath { ref path } if path == "../data/devices/card.toml")
    );
}

#[test]
fn clean_board_lints_ok() {
    let report = lint_files(&files(), "boards/test/board.toml").expect("board loads");

    assert_eq!(report.status, Status::Ok);
}

#[test]
fn board_with_a_lint_error_reports_its_code() {
    let report = lint_files(&files(), "boards/test/orphan.toml").expect("board loads");
    let json = serde_json::to_value(&report).unwrap();

    assert_eq!(json["status"], "error");
    assert!(json["diagnostics"][0]["code"].is_string());
}

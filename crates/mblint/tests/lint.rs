//! `mblint lint` checks a board under a data root and reports as `docs/spec/cli.md` specifies.

use std::path::PathBuf;
use std::process::{Command, Output};

use serde_json::Value;

fn lint(board: &str, json: bool) -> Output {
    let data_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/data");
    let mut args = vec![
        "lint",
        "--data-root",
        data_root.to_str().expect("UTF-8 path"),
        board,
    ];
    if json {
        args.push("--json");
    }
    Command::new(env!("CARGO_BIN_EXE_mblint"))
        .args(&args)
        .output()
        .expect("mblint must run")
}

fn stdout(output: &Output) -> String {
    String::from_utf8(output.stdout.clone()).expect("stdout is UTF-8")
}

#[test]
fn clean_board_exits_0_with_an_ok_report() {
    let output = lint("boards/test/board.toml", true);
    let report: Value = serde_json::from_str(&stdout(&output)).expect("stdout is JSON");

    assert_eq!(output.status.code(), Some(0));
    assert_eq!(report["status"], "ok");
}

#[test]
fn board_with_a_lint_error_exits_1_naming_its_code() {
    let output = lint("boards/test/orphan.toml", true);
    let report: Value = serde_json::from_str(&stdout(&output)).expect("stdout is JSON");

    assert_eq!(output.status.code(), Some(1));
    assert_eq!(report["status"], "error");
    assert_eq!(report["diagnostics"][0]["code"], "UNKNOWN_PARENT");
}

#[test]
fn text_report_carries_each_diagnostic_message() {
    let output = lint("boards/test/orphan.toml", false);

    assert_eq!(output.status.code(), Some(1));
    assert!(stdout(&output).contains("The parent of PCIE1, root_gpu, names no node."));
}

#[test]
fn board_path_leaving_the_data_root_exits_2() {
    let output = lint("../data/boards/test/board.toml", true);

    assert_eq!(output.status.code(), Some(2));
    assert!(output.stdout.is_empty());
}

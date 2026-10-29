//! `mblint check` evaluates a rig under a data root and reports as `docs/spec/cli.md` specifies.

use std::path::PathBuf;
use std::process::{Command, Output};

use serde_json::Value;

fn data_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/data")
}

fn mblint(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_mblint"))
        .args(args)
        .output()
        .expect("mblint must run")
}

fn check(rig: &str, json: bool) -> Output {
    let data_root = data_root();
    let mut args = vec![
        "check",
        "--data-root",
        data_root.to_str().expect("UTF-8 path"),
        rig,
    ];
    if json {
        args.push("--json");
    }
    mblint(&args)
}

fn stdout(output: &Output) -> String {
    String::from_utf8(output.stdout.clone()).expect("stdout is UTF-8")
}

#[test]
fn rig_with_only_warnings_exits_0_with_its_json_report() {
    let output = check("rigs/warning.toml", true);
    let report: Value = serde_json::from_str(&stdout(&output)).expect("stdout is JSON");

    assert_eq!(output.status.code(), Some(0));
    assert_eq!(report["status"], "warning");
    assert_eq!(report["diagnostics"][0]["code"], "BOTTLENECK");
    assert_eq!(report["links"]["PCIE1"]["lanes"], 4);
}

#[test]
fn rig_with_an_error_exits_1() {
    let output = check("rigs/error.toml", true);
    let report: Value = serde_json::from_str(&stdout(&output)).expect("stdout is JSON");

    assert_eq!(output.status.code(), Some(1));
    assert_eq!(report["status"], "error");
}

#[test]
fn text_report_carries_each_diagnostic_message() {
    let output = check("rigs/warning.toml", false);

    assert_eq!(output.status.code(), Some(0));
    assert!(
        stdout(&output).contains("PCIE1 runs at 63.02 Gbps, below the 252.06 Gbps it requires.")
    );
}

#[test]
fn clean_rig_exits_0() {
    let output = check("rigs/ok.toml", false);

    assert_eq!(output.status.code(), Some(0));
}

#[test]
fn unreadable_file_exits_2_naming_it_on_stderr_only() {
    let output = check("rigs/missing_device.toml", true);
    let stderr = String::from_utf8(output.stderr).expect("stderr is UTF-8");

    assert_eq!(output.status.code(), Some(2));
    assert!(stderr.contains("devices/none.toml"), "{stderr}");
    assert!(output.stdout.is_empty());
}

#[test]
fn missing_rig_argument_exits_2() {
    assert_eq!(mblint(&["check"]).status.code(), Some(2));
}

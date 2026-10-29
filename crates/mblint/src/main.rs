//! `mblint`: checks a PC build against its motherboard, and lints boards, as `docs/spec/cli.md`
//! specifies.

use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use mblint_core::evaluate::evaluate;
use mblint_core::lint::lint;
use mblint_core::report::{LintReport, PassState, Report, Severity, Status, lint_report, report};
use mblint_core::rig::{LoadError, load_board, load_rig};
use serde::Serialize;

#[derive(Parser)]
#[command(name = "mblint", version, about)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Evaluate a rig and report what its devices get.
    Check {
        /// Path of the rig file, relative to the data root.
        rig: String,
        /// The directory holding boards/, devices/ and rigs/.
        #[arg(long, default_value = ".")]
        data_root: PathBuf,
        /// Print the report as JSON.
        #[arg(long)]
        json: bool,
    },
    /// Check a board file on its own.
    Lint {
        /// Path of the board file, relative to the data root.
        board: String,
        /// The directory holding boards/, devices/ and rigs/.
        #[arg(long, default_value = ".")]
        data_root: PathBuf,
        /// Print the report as JSON.
        #[arg(long)]
        json: bool,
    },
}

/// Exits 0 without errors, 1 with errors, and 2 when a file cannot be loaded; clap exits 2 on
/// invalid arguments.
fn main() -> ExitCode {
    match Cli::parse().command {
        Command::Check {
            rig,
            data_root,
            json,
        } => check(&rig, &data_root, json),
        Command::Lint {
            board,
            data_root,
            json,
        } => lint_board(&board, &data_root, json),
    }
}

fn check(rig: &str, data_root: &Path, json: bool) -> ExitCode {
    match load_rig(rig, reader(data_root)) {
        Ok(loaded) => {
            let report = report(&evaluate(&loaded));
            print_report(&report, json, || text(&report));
            exit_code(report.status)
        }
        Err(error) => load_failure(&error),
    }
}

fn lint_board(board: &str, data_root: &Path, json: bool) -> ExitCode {
    match load_board(board, reader(data_root)) {
        Ok(board) => {
            let report = lint_report(&lint(&board));
            print_report(&report, json, || lint_text(&report));
            exit_code(report.status)
        }
        Err(error) => load_failure(&error),
    }
}

/// Reads data-root-relative paths, which the core has already checked stay under the root.
fn reader(data_root: &Path) -> impl Fn(&str) -> Result<String, String> + '_ {
    |path: &str| fs::read_to_string(data_root.join(path)).map_err(|e| e.to_string())
}

fn load_failure(error: &LoadError) -> ExitCode {
    eprintln!("mblint: {error}");
    ExitCode::from(2)
}

fn print_report(report: &impl Serialize, json: bool, text: impl Fn() -> String) {
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(report).expect("a report always serializes")
        );
    } else {
        print!("{}", text());
    }
}

fn exit_code(status: Status) -> ExitCode {
    match status {
        Status::Error => ExitCode::from(1),
        Status::Ok | Status::Warning => ExitCode::SUCCESS,
    }
}

/// The report for people: status, diagnostics, passes not run, then links.
fn text(report: &Report) -> String {
    let mut out = String::new();
    let _ = writeln!(out, "status: {}", status_name(report.status));
    for finding in &report.diagnostics {
        let _ = writeln!(
            out,
            "{}: {}",
            severity_name(finding.severity),
            finding.message
        );
    }
    let passes = [
        ("lanes", report.passes.lanes),
        ("tunnels", report.passes.tunnels),
        ("throughput", report.passes.throughput),
    ];
    let not_run: Vec<&str> = passes
        .iter()
        .filter(|(_, state)| *state == PassState::NotRun)
        .map(|(name, _)| *name)
        .collect();
    if !not_run.is_empty() {
        let _ = writeln!(out, "not run: {}", not_run.join(", "));
    }
    for (socket, link) in &report.links {
        let _ = writeln!(
            out,
            "{socket}: PCIe Gen{} x{}, {:.2} Gbps",
            link.generation, link.lanes, link.gbps
        );
    }
    out
}

/// The lint report for people: status, then diagnostics.
fn lint_text(report: &LintReport) -> String {
    let mut out = String::new();
    let _ = writeln!(out, "status: {}", status_name(report.status));
    for finding in &report.diagnostics {
        let _ = writeln!(
            out,
            "{}: {}",
            severity_name(finding.severity),
            finding.message
        );
    }
    out
}

fn status_name(status: Status) -> &'static str {
    match status {
        Status::Ok => "ok",
        Status::Warning => "warning",
        Status::Error => "error",
    }
}

fn severity_name(severity: Severity) -> &'static str {
    match severity {
        Severity::Error => "error",
        Severity::Warning => "warning",
    }
}

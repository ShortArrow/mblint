//! `mblint`: checks a PC build against its motherboard, as `docs/spec/cli.md` specifies.

use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use mblint_core::evaluate::evaluate;
use mblint_core::report::{PassState, Report, Severity, Status, report};
use mblint_core::rig::load_rig;

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
    }
}

fn check(rig: &str, data_root: &Path, json: bool) -> ExitCode {
    let read = |path: &str| fs::read_to_string(data_root.join(path)).map_err(|e| e.to_string());
    let loaded = match load_rig(rig, read) {
        Ok(loaded) => loaded,
        Err(error) => {
            eprintln!("mblint: {error}");
            return ExitCode::from(2);
        }
    };
    let report = report(&evaluate(&loaded));
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(&report).expect("a report always serializes")
        );
    } else {
        print!("{}", text(&report));
    }
    match report.status {
        Status::Error => ExitCode::from(1),
        Status::Ok | Status::Warning => ExitCode::SUCCESS,
    }
}

/// The report for people: status, diagnostics, passes not run, then links.
fn text(report: &Report) -> String {
    let mut out = String::new();
    let status = match report.status {
        Status::Ok => "ok",
        Status::Warning => "warning",
        Status::Error => "error",
    };
    let _ = writeln!(out, "status: {status}");
    for finding in &report.diagnostics {
        let severity = match finding.severity {
            Severity::Error => "error",
            Severity::Warning => "warning",
        };
        let _ = writeln!(out, "{severity}: {}", finding.message);
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

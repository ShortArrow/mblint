//! The reports of an evaluation and of a lint, shared by every front end so that each prints the
//! same result.

use std::collections::BTreeMap;

use serde::Serialize;

use crate::evaluate::{Evaluation, PassOutcome};
use crate::iommu::SharedIommuGroup;
use crate::throughput::Link;
use crate::{lanes, lint, physical, throughput, tunnels};

/// What `mblint check` prints, as `docs/spec/cli.md` specifies.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export))]
pub struct Report {
    pub status: Status,
    pub passes: Passes,
    /// In pass order, and within a pass in the order the pass reports them.
    pub diagnostics: Vec<Finding>,
    /// The link of each rated device, keyed by socket path.
    pub links: BTreeMap<String, Link>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Ok,
    Warning,
    Error,
}

/// Whether each pass ran.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct Passes {
    pub physical: PassState,
    pub lanes: PassState,
    pub tunnels: PassState,
    pub throughput: PassState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "snake_case")]
pub enum PassState {
    Ran,
    NotRun,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "snake_case")]
pub enum Pass {
    Physical,
    Lanes,
    Tunnels,
    Throughput,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Error,
    Warning,
}

/// One diagnostic with the pass that reported it, its severity and an English message.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct Finding {
    pub pass: Pass,
    pub severity: Severity,
    /// Serialized as `code` and the diagnostic's fields.
    #[serde(flatten)]
    pub diagnostic: Diagnostic,
    pub message: String,
}

/// A diagnostic of any pass.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(untagged)]
pub enum Diagnostic {
    Physical(physical::Diagnostic),
    Lanes(lanes::Diagnostic),
    Tunnels(tunnels::Diagnostic),
    Throughput(throughput::Diagnostic),
    Iommu(IommuDiagnostic),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[serde(tag = "code", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IommuDiagnostic {
    /// Node ids in order.
    SharedIommuGroup { group: u32, endpoints: Vec<String> },
}

impl From<&SharedIommuGroup> for IommuDiagnostic {
    fn from(shared: &SharedIommuGroup) -> Self {
        IommuDiagnostic::SharedIommuGroup {
            group: shared.group,
            endpoints: shared.endpoints.clone(),
        }
    }
}

/// Collects the diagnostics and links of every pass that ran, and the status they amount to.
pub fn report(evaluation: &Evaluation) -> Report {
    let mut diagnostics: Vec<Finding> = evaluation
        .physical
        .iter()
        .map(|d| {
            finding(
                Pass::Physical,
                Severity::Error,
                Diagnostic::Physical(d.clone()),
            )
        })
        .collect();
    if let PassOutcome::Ran(lanes) = &evaluation.lanes {
        diagnostics.extend(
            lanes
                .diagnostics
                .iter()
                .map(|d| finding(Pass::Lanes, Severity::Error, Diagnostic::Lanes(d.clone()))),
        );
    }
    if let PassOutcome::Ran(tunnels) = &evaluation.tunnels {
        diagnostics.extend(tunnels.diagnostics.iter().map(|d| {
            let severity = if d.is_error() {
                Severity::Error
            } else {
                Severity::Warning
            };
            finding(Pass::Tunnels, severity, Diagnostic::Tunnels(d.clone()))
        }));
    }
    if let PassOutcome::Ran(throughput) = &evaluation.throughput {
        diagnostics.extend(throughput.diagnostics.iter().map(|d| {
            finding(
                Pass::Throughput,
                Severity::Warning,
                Diagnostic::Throughput(d.clone()),
            )
        }));
    }
    if let PassOutcome::Ran(groups) = &evaluation.iommu {
        diagnostics.extend(groups.iter().map(|group| {
            finding(
                Pass::Throughput,
                Severity::Warning,
                Diagnostic::Iommu(group.into()),
            )
        }));
    }

    let links = match &evaluation.throughput {
        PassOutcome::Ran(throughput) => throughput.links.clone(),
        PassOutcome::NotRun => BTreeMap::new(),
    };
    Report {
        status: status(&diagnostics),
        passes: Passes {
            physical: PassState::Ran,
            lanes: state(&evaluation.lanes),
            tunnels: state(&evaluation.tunnels),
            throughput: state(&evaluation.throughput),
        },
        diagnostics,
        links,
    }
}

fn finding(pass: Pass, severity: Severity, diagnostic: Diagnostic) -> Finding {
    Finding {
        pass,
        severity,
        message: message(&diagnostic),
        diagnostic,
    }
}

fn state<T>(outcome: &PassOutcome<T>) -> PassState {
    match outcome {
        PassOutcome::Ran(_) => PassState::Ran,
        PassOutcome::NotRun => PassState::NotRun,
    }
}

fn status(diagnostics: &[Finding]) -> Status {
    status_of(diagnostics.iter().map(|f| f.severity))
}

fn status_of(severities: impl Iterator<Item = Severity>) -> Status {
    let mut status = Status::Ok;
    for severity in severities {
        match severity {
            Severity::Error => return Status::Error,
            Severity::Warning => status = Status::Warning,
        }
    }
    status
}

/// What `mblint lint` prints, as `docs/spec/cli.md` specifies.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export))]
pub struct LintReport {
    pub status: Status,
    /// In the order lint reports them.
    pub diagnostics: Vec<LintFinding>,
}

/// One lint diagnostic with its severity and an English message.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct LintFinding {
    pub severity: Severity,
    /// Serialized as `code` and the diagnostic's fields.
    #[serde(flatten)]
    pub diagnostic: lint::Diagnostic,
    pub message: String,
}

/// Every lint diagnostic as an error, and the status they amount to.
pub fn lint_report(diagnostics: &[lint::Diagnostic]) -> LintReport {
    let diagnostics: Vec<LintFinding> = diagnostics
        .iter()
        .map(|d| LintFinding {
            severity: Severity::Error,
            message: lint_message(d),
            diagnostic: d.clone(),
        })
        .collect();
    LintReport {
        status: status_of(diagnostics.iter().map(|f| f.severity)),
        diagnostics,
    }
}

/// A sentence describing the lint diagnostic. Its wording is not part of the report's contract.
fn lint_message(diagnostic: &lint::Diagnostic) -> String {
    use lint::Diagnostic as L;
    match diagnostic {
        L::InvalidNodeId { node } => format!("The node id {node} contains a dot or is reserved."),
        L::UnknownParent { node, parent } => {
            format!("The parent of {node}, {parent}, names no node.")
        }
        L::InvalidParent { node, parent } => {
            format!("The parent of {node}, {parent}, supplies no lanes.")
        }
        L::ParentCycle { nodes } => format!("The parents of {} form a cycle.", nodes.join(", ")),
        L::UnknownModeTarget { mux, node } => {
            format!("A mode of {mux} names {node}, which is missing or of the wrong kind.")
        }
        L::ForeignAllocation { mux, node } => {
            format!("A mode of {mux} allocates lanes to {node}, which is not under it.")
        }
        L::UnreachableSocket { node } => {
            format!("No mode of the mux above {node} allocates lanes to it.")
        }
        L::NoMatchingMode { mux, occupancy } => {
            format!("No mode of {mux} holds when {}.", states(occupancy))
        }
        L::LaneOvercommit {
            root,
            supplied,
            demanded,
            occupancy,
        } => format!(
            "{root} supplies {supplied} lanes but {demanded} are demanded when {}.",
            states(occupancy)
        ),
    }
}

/// An occupancy in words, such as `M2_1 runs sata and PCIE2 is empty`.
fn states(occupancy: &BTreeMap<String, lint::Occupant>) -> String {
    if occupancy.is_empty() {
        return "every socket is empty".to_string();
    }
    occupancy
        .iter()
        .map(|(socket, occupant)| match occupant {
            lint::Occupant::Empty => format!("{socket} is empty"),
            lint::Occupant::Running(protocol) => {
                format!("{socket} runs {}", protocol_name(*protocol))
            }
        })
        .collect::<Vec<_>>()
        .join(" and ")
}

fn protocol_name(protocol: crate::protocol::Protocol) -> &'static str {
    use crate::protocol::Protocol::*;
    match protocol {
        Pcie => "pcie",
        Sata => "sata",
        Usb4 => "usb4",
        Usb3Gen1x1 => "usb3_gen1x1",
        Displayport => "displayport",
    }
}

/// A sentence describing the diagnostic. Its wording is not part of the report's contract.
fn message(diagnostic: &Diagnostic) -> String {
    use physical::Diagnostic as P;
    match diagnostic {
        Diagnostic::Physical(d) => match d {
            P::UnknownSocket { socket } => format!("{socket} leads to no socket."),
            P::WrongSocketCategory { socket } => {
                format!("The device in {socket} is not made for that category of socket.")
            }
            P::EdgeTooWide { socket, edge, slot } => format!(
                "The {} card edge in {socket} is wider than the closed-ended {} slot.",
                width(*edge),
                width(*slot)
            ),
            P::KeyMismatch { socket, slot } => {
                format!("The module in {socket} has no notch for the slot's {slot:?} key.")
            }
            P::Obstructed { socket, by } => format!("The card in {by} covers {socket}."),
        },
        Diagnostic::Lanes(d) => match d {
            lanes::Diagnostic::NoMatchingMode { mux } => format!("No mode of {mux} applies."),
            lanes::Diagnostic::SocketDisabled { socket, mux } => {
                format!("{socket} is disabled by the selected mode of {mux}.")
            }
            lanes::Diagnostic::LaneOvercommit {
                root,
                supplied,
                demanded,
            } => format!("{root} supplies {supplied} lanes but {demanded} are demanded."),
        },
        Diagnostic::Tunnels(d) => match d {
            tunnels::Diagnostic::DpAltModeUnsupported { socket } => {
                format!("{socket} has no DP Alt Mode.")
            }
            tunnels::Diagnostic::DpLanesInsufficient {
                socket,
                required,
                available,
            } => format!(
                "The display in {socket} needs {required} DP lanes, but the port drives {available}."
            ),
            tunnels::Diagnostic::UsbLimitedToUsb2 { socket } => format!(
                "The display in {socket} takes all four lanes, so USB data on the port runs at USB 2.0."
            ),
            tunnels::Diagnostic::DpLanesUnknown { socket } => format!(
                "The DP Alt Mode lanes of {socket} are unknown, so whether the display gets its lanes is not known."
            ),
        },
        Diagnostic::Throughput(d) => match d {
            throughput::Diagnostic::Bottleneck {
                socket,
                required_gbps,
                actual_gbps,
            } => format!(
                "{socket} runs at {actual_gbps:.2} Gbps, below the {required_gbps:.2} Gbps it requires."
            ),
            throughput::Diagnostic::UnratedLink { socket } => {
                format!("The link in {socket} cannot be rated.")
            }
        },
        Diagnostic::Iommu(IommuDiagnostic::SharedIommuGroup { group, endpoints }) => {
            format!("IOMMU group {group} is shared by {}.", endpoints.join(", "))
        }
    }
}

fn width(width: crate::connector::PcieWidth) -> &'static str {
    use crate::connector::PcieWidth::*;
    match width {
        X1 => "x1",
        X4 => "x4",
        X8 => "x8",
        X16 => "x16",
    }
}

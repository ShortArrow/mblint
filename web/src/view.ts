import type { LintReport } from "./report/LintReport";

/** The lint report as lines for people: the status, then each diagnostic, as `mblint lint` prints it. */
export function lintLines(report: LintReport): string[] {
  return [
    `status: ${report.status}`,
    ...report.diagnostics.map((finding) => `${finding.severity}: ${finding.message}`),
  ];
}

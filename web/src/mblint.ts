import * as wasm from "./wasm/mblint_wasm";
import type { LintReport } from "./report/LintReport";
import type { Report } from "./report/Report";

/** Files by data-root-relative path, as `docs/spec/web.md` specifies. */
export type Files = Record<string, string>;

/** The report of `mblint check --json` for `rig`; throws an `Error` naming a file that cannot be loaded. */
export function check(files: Files, rig: string): Report {
  return wasm.check(files, rig) as Report;
}

/** The report of `mblint lint --json` for `board`; throws an `Error` naming a file that cannot be loaded. */
export function lint(files: Files, board: string): LintReport {
  return wasm.lint(files, board) as LintReport;
}

//! The core as Wasm for the web simulator, as `docs/spec/web.md` specifies.

use std::collections::BTreeMap;

use mblint_core::catalog::{self, Entry};
use mblint_core::evaluate::evaluate;
use mblint_core::layout::{self, LayoutNode};
use mblint_core::lint::lint;
use mblint_core::report::{LintReport, Report, lint_report, report};
use mblint_core::rig::{LoadError, load_board, load_rig};
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Files by data-root-relative path, as the page supplies them.
pub type Files = BTreeMap<String, String>;

/// Evaluates the rig at `rig`, reading only from `files`.
pub fn check_files(files: &Files, rig: &str) -> Result<Report, LoadError> {
    load_rig(rig, reader(files)).map(|loaded| report(&evaluate(&loaded)))
}

/// Lints the board at `board`, reading only from `files`.
pub fn lint_files(files: &Files, board: &str) -> Result<LintReport, LoadError> {
    load_board(board, reader(files)).map(|board| lint_report(&lint(&board)))
}

/// The board of the rig at `rig` as the page draws it, reading only from `files`.
pub fn layout_files(files: &Files, rig: &str) -> Result<BTreeMap<String, LayoutNode>, LoadError> {
    load_rig(rig, reader(files)).map(|loaded| layout::layout(&loaded))
}

/// What each file in `files` is, keyed by its path.
pub fn catalog_files(files: &Files) -> BTreeMap<String, Entry> {
    catalog::catalog(files)
}

fn reader(files: &Files) -> impl Fn(&str) -> Result<String, String> + '_ {
    |path: &str| {
        files
            .get(path)
            .cloned()
            .ok_or_else(|| "not among the given files".to_string())
    }
}

/// `check(files, rig)`: the report of `mblint check --json`, or a thrown `Error` naming the file
/// that cannot be loaded.
#[wasm_bindgen]
pub fn check(files: JsValue, rig: &str) -> Result<JsValue, JsError> {
    let report = check_files(&from_js(files)?, rig).map_err(|e| JsError::new(&e.to_string()))?;
    to_js(&report)
}

/// `lint(files, board)`: the report of `mblint lint --json`, or a thrown `Error` naming the file
/// that cannot be loaded.
#[wasm_bindgen(js_name = lint)]
pub fn lint_board(files: JsValue, board: &str) -> Result<JsValue, JsError> {
    let report = lint_files(&from_js(files)?, board).map_err(|e| JsError::new(&e.to_string()))?;
    to_js(&report)
}

/// `catalog(files)`: what each file is, keyed by its path.
#[wasm_bindgen]
pub fn catalog(files: JsValue) -> Result<JsValue, JsError> {
    to_js(&catalog_files(&from_js(files)?))
}

/// `layout(files, rig)`: the rig's board as the page draws it, or a thrown `Error` naming the
/// file that cannot be loaded.
#[wasm_bindgen]
pub fn layout(files: JsValue, rig: &str) -> Result<JsValue, JsError> {
    let nodes = layout_files(&from_js(files)?, rig).map_err(|e| JsError::new(&e.to_string()))?;
    to_js(&nodes)
}

fn from_js(files: JsValue) -> Result<Files, JsError> {
    serde_wasm_bindgen::from_value(files).map_err(|e| JsError::new(&e.to_string()))
}

/// Serializes maps as plain objects, so the value matches the CLI's JSON.
fn to_js(report: &impl Serialize) -> Result<JsValue, JsError> {
    report
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(|e| JsError::new(&e.to_string()))
}

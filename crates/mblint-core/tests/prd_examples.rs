//! The examples in `docs/prd.md` must conform to the schema the engine reads.

use std::collections::BTreeMap;

use mblint_core::board::Board;
use mblint_core::device::Device;
use mblint_core::lanes::resolve_lanes;
use mblint_core::occupancy::Occupancy;
use mblint_core::physical::check_physical;

const PRD: &str = include_str!("../../../docs/prd.md");

/// The first TOML code block after the heading that starts with `heading`.
fn example(heading: &str) -> &'static str {
    let after_heading = PRD
        .split_once(&format!("\n{heading}"))
        .unwrap_or_else(|| panic!("PRD has no heading {heading:?}"))
        .1;
    let block = after_heading
        .split_once("```toml\n")
        .expect("heading is followed by a TOML block")
        .1;
    block.split_once("```").expect("TOML block is closed").0
}

fn prd_board() -> Board {
    Board::from_toml(example("### 4.1 ")).expect("PRD board example must parse")
}

fn prd_card() -> Device {
    Device::from_toml(example("#### Example 4: ")).expect("PRD card example must parse")
}

fn prd_ssd() -> Device {
    Device::from_toml(example("#### Example 5: ")).expect("PRD SSD example must parse")
}

#[test]
fn rig_of_the_prd_examples_fits_physically() {
    let installed = BTreeMap::from([
        ("PCI_E1".to_string(), prd_card()),
        ("M2_2".to_string(), prd_ssd()),
    ]);

    assert!(check_physical(&prd_board(), &installed).is_empty());
}

#[test]
fn rig_of_the_prd_examples_resolves_without_lane_problems() {
    let mut occupancy = Occupancy::default();
    occupancy.install("PCI_E1", prd_card().protocol());
    occupancy.install("M2_2", prd_ssd().protocol());

    let result = resolve_lanes(&prd_board(), &occupancy);

    assert_eq!(result.allocations.get("PCI_E1"), Some(&16));
    assert_eq!(result.allocations.get("M2_2"), Some(&4));
    assert!(result.diagnostics.is_empty());
}

#[test]
fn prd_adapter_examples_parse() {
    for heading in ["#### Example 1: ", "#### Example 2: "] {
        let adapter = Device::from_toml(example(heading));
        assert!(adapter.is_ok(), "{heading}: {:?}", adapter.err());
    }
}

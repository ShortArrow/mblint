# ADR-0002: IOMMU groups are declared in the board definition

[日本語](0002-iommu-groups-declared-in-board.jp.md)

- Status: Accepted
- Date: 2026-10-27

## Context

Pass 4 reports which devices share an IOMMU group. The original draft of the PRD gave the board only a string `iommu_group_hint`, from which the numeric `group_id = 14` and the onboard SATA controller in the CLI output example cannot be derived.

## Decision

- Sockets and onboard controllers carry `iommu_group = <integer>`, the group number observed on real hardware under `/sys/kernel/iommu_groups`.
- Onboard controllers such as `ONBOARD_SATA_CONTROLLER` are a node type of their own, `controller`.
- The engine does not infer groups. It collects nodes with the same number and reports them as the set that must be passed through together.
- `iommu_group_hint` is removed.

## Rationale

IOMMU grouping depends on ACS support and also on the BIOS / AGESA version, so inferring it from the topology can be wrong. With observed values as input, the output depends on the input alone.

## Alternatives not taken

- Inference from the topology and ACS attributes: boards could be written without hardware, but a wrong guess would be reported with a convincing group number.
- Declared values with inference as a fallback: keeps the inference logic to maintain. To be revisited if the need appears.

## Consequences

Pass 4 skips IOMMU diagnosis for boards without `iommu_group`. Writing a board definition requires observing the real hardware.

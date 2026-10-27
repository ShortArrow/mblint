# ADR-0000: Record architecture decisions

[日本語](0000-record-architecture-decisions.jp.md)

- Status: Accepted

## Context

Decisions about the schema and the engine have to stay readable after the conversation that produced them is gone, and the PRD alone does not say why its examples look the way they do.

## Decision

Each decision is a file `docs/adr/NNNN-<title>.md` with a Japanese counterpart `NNNN-<title>.jp.md`, numbered in order of acceptance. A file has these parts:

| Part | Contents |
| --- | --- |
| Title | `ADR-NNNN: <the decision, stated as a sentence>` |
| Status | `Accepted`, or `Superseded by ADR-NNNN` |
| Context | The forces that made a decision necessary |
| Decision | What was decided |
| Rationale | Why this option |
| Alternatives not taken | The options rejected, and why |
| Consequences | What follows from the decision; omitted if nothing does |

An ADR carries no date. When it was accepted, and every later change to it, is recorded by the commits that touch the file.

An accepted ADR is not rewritten. A decision that replaces it is a new ADR, and the old one only has its status changed to `Superseded by ADR-NNNN`.

## Rationale

- A date in the file duplicates what git already records, and can disagree with it.
- Keeping accepted ADRs unchanged lets a reader see what was decided at the time, even after the decision has been replaced.

## Alternatives not taken

- Recording decisions only in commit messages: they cannot be found by topic, and a decision that spans several commits has no single place.

# Contributing to mblint

[日本語](CONTRIBUTING.jp.md)

## Language

mblint is an open-source project. Write code comments, docstrings, commit messages and pull requests in English.

Documentation is written in English and kept with a Japanese counterpart:

| English | Japanese |
| --- | --- |
| `README.md` | `docs/README.jp.md` |
| `docs/**/<name>.md` | `docs/**/<name>.jp.md`, in the same directory |

The English file is the source. Change both files of a pair in the same commit, so that neither side describes a state the other has left.

## License

mblint is licensed under either of [MIT](../LICENSE-MIT) or [Apache-2.0](../LICENSE-APACHE), at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in mblint by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

## Where things are written

| Question | Place |
| --- | --- |
| What the product must do | [`docs/prd.md`](prd.md) |
| What the data files contain and how the passes evaluate them | [`docs/spec/schema.md`](spec/schema.md), [`docs/spec/passes.md`](spec/passes.md) |
| Why a design decision was made | `docs/adr/NNNN-<title>.md`, written as in [Architecture decision records](#architecture-decision-records) |
| What is still undecided | [`docs/spec/open-issues.md`](spec/open-issues.md) |
| What an interface guarantees | The docstring of the type or function |
| Why a single change was made | The commit message, in one or two sentences |

A decision that settles an open issue is written into the specification and recorded as an ADR, and the issue is removed from `open-issues.md`.

## Architecture decision records

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

An ADR carries no date. The commits that touch the file record when it was accepted and every later change, and a date written in the file could disagree with them.

An accepted ADR is not rewritten, so that what was decided at the time stays readable after the decision is replaced. A decision that replaces it is a new ADR, and the old one only has its status changed to `Superseded by ADR-NNNN`.

## Development workflow

Changes follow the Red-Green-Refactor cycle:

1. Write a test that states the expected behaviour and watch it fail.
2. Write the smallest change that makes it pass.
3. Refactor with all tests green.

Keep structural changes (renames, moves, extractions) and behavioural changes in separate commits.

Before opening a pull request, run:

```sh
cargo test
cargo clippy --all-targets
```

## Repository layout

| Path | Contents |
| --- | --- |
| `crates/mblint-core` | Topology model and resolution passes, shared by the CLI and the Wasm build |
| `docs/` | Requirements, specifications, ADRs and open issues |

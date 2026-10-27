# Contributing to mblint

## Language

mblint is an open-source project. Write every Markdown file, code comment, docstring, commit message and pull request in English.

## License

mblint is licensed under either of [MIT](../LICENSE-MIT) or [Apache-2.0](../LICENSE-APACHE), at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in mblint by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

## Where things are written

| Question | Place |
| --- | --- |
| What the product must do | [`docs/prd.md`](prd.md) |
| Why a design decision was made | `docs/adr/NNNN-<title>.md`, one decision per file, frozen once accepted |
| What is still undecided | [`docs/spec/open-issues.md`](spec/open-issues.md) |
| What an interface guarantees | The docstring of the type or function |
| Why a single change was made | The commit message, in one or two sentences |

A decision that settles an open issue is recorded as an ADR, and the issue is removed from `open-issues.md`.

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
| `docs/` | Requirements, ADRs and open issues |

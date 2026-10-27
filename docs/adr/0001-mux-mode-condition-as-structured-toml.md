# ADR-0001: Mux mode conditions are structured TOML

[日本語](0001-mux-mode-condition-as-structured-toml.jp.md)

- Status: Accepted

## Context

The original draft of the PRD wrote mux mode conditions as string expressions such as `condition = "PCI_E2 == empty"`, without defining their grammar. The PRD requires determinism across native and Wasm builds, and board definitions are reviewed in pull requests where CI must catch mistakes.

## Decision

A condition is a TOML table named `when`, not a string expression.

```toml
[[nodes.mux_peg_bifurcation.modes]]
when = { socket = "PCI_E2", is = "occupied" }
allocate = { PCI_E1 = 8, PCI_E2 = 8 }
```

## Rationale

- The shape of a condition becomes a schema type, so an unknown state is rejected when the board is parsed.
- With no expression parser, there is one less place where native and Wasm evaluation could diverge.

## Alternatives not taken

- A string DSL: board files could keep the draft's notation, but the project would own a grammar, a parser and error-position reporting.

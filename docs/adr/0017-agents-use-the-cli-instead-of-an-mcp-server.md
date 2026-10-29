# ADR-0017: LLM agents use the CLI, and mblint has no MCP server

[日本語](0017-agents-use-the-cli-instead-of-an-mcp-server.jp.md)

- Status: Accepted

## Context

The PRD planned an MCP server, `mblint mcp`, through which LLM clients would explore topologies and diagnose builds over stdio, alongside the CLI in Phase 2. `mblint check` and `mblint lint` now print their reports as JSON with `--json`, under codes named in the specification and with exit statuses that tell errors from warnings. Agents that run commands can call them directly.

## Decision

- mblint has no MCP server. LLM agents use the CLI with `--json`.
- Phase 2 of the roadmap is the CLI alone.

## Rationale

- The CLI's JSON reports already carry everything an MCP tool would return, so a server would add a second interface to keep in step without giving agents anything new.
- One front end fewer leaves the core with two consumers, the CLI and the Wasm build.

## Alternatives not taken

- An MCP server wrapping `check` and `lint`: it duplicates the CLI's interface and needs its own protocol dependency, tests and documentation.

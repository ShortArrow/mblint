# ADR-0017: The MCP server waits until the web simulator has matured

[日本語](0017-mcp-server-waits-for-the-web-simulator.jp.md)

- Status: Accepted

## Context

The PRD planned an MCP server, `mblint mcp`, through which LLM clients would explore topologies and diagnose builds over stdio, alongside the CLI in Phase 2. `mblint check` and `mblint lint` now print their reports as JSON with `--json`, under codes named in the specification and with exit statuses that tell errors from warnings, so agents that run commands can already use mblint. The web simulator of Phase 3 has not been started.

## Decision

- Phase 2 of the roadmap is the CLI alone.
- The MCP server moves to a new last phase, taken up once the web simulator has matured.

## Rationale

- Agents are served by the CLI's JSON reports in the meantime, while people have no interface but the CLI until the web simulator exists.
- Building the MCP server later lets it follow the core's interface after the Wasm build has shaped it, instead of fixing a second interface now.

## Alternatives not taken

- Building the MCP server now, in Phase 2: it delays the web simulator for a front end whose needs the CLI already meets.
- Dropping the MCP server: an MCP client that cannot run commands still has no way to use mblint.

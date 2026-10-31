# ADR-0018: The web simulator is a TypeScript page over a thin Wasm build of the core

[日本語](0018-web-simulator-is-typescript-over-a-thin-wasm-core.jp.md)

- Status: Superseded by ADR-0019

## Context

Phase 3 of the roadmap is a web simulator that runs `mblint-core` in the browser as Wasm, with no backend, on GitHub Pages or Cloudflare Pages. The core reads every file through a reader passed to it and already prints its results as the JSON reports that `mblint check --json` and `mblint lint --json` specify. The repository is hosted on GitHub and its CI runs on GitHub Actions.

## Decision

- The page is written in TypeScript and built with Vite, under `web/`.
- A crate `mblint-wasm` exposes `check` and `lint` through wasm-bindgen. It holds no logic of its own: it reads files from the map the page passes, calls the core, and returns the core's report.
- The reports the page receives are the JSON reports of the CLI, and the page's TypeScript types for them are generated from the core's Rust types.
- The page is published on GitHub Pages by GitHub Actions.

## Rationale

- One report format serves the CLI, the page and later the MCP server, so a diagnostic means the same thing in each.
- Types generated from the Rust types cannot drift from what the core returns, which hand-written TypeScript types or JSON decoders could.
- TypeScript draws the slot layout and the bus graph with the DOM and SVG directly.
- The repository and its CI are already on GitHub, so Pages needs no second account.

## Alternatives not taken

- Elm: its state model fits the page, but it reaches Wasm only through JavaScript ports, and the report types would be written a second time as decoders.
- A Rust front end such as Leptos: one language, but slower builds and less to draw SVG with.
- Cloudflare Pages: equally static, but a second service to keep an account and settings for.

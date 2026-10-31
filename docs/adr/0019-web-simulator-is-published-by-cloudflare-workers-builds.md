# ADR-0019: The web simulator is a TypeScript page over a thin Wasm build of the core, published at mblint.shortarrow.jp by Cloudflare Workers Builds

[日本語](0019-web-simulator-is-published-by-cloudflare-workers-builds.jp.md)

- Status: Accepted

## Context

ADR-0018 decided the page, the Wasm crate and the report types, and published the page on GitHub Pages. The owner's other static sites, such as crc.shortarrow.jp, are Cloudflare Workers serving static assets under shortarrow.jp, built by Workers Builds from their repositories. Workers Builds deploys a pushed branch without waiting for CI, and its build image has Node.js but no Rust. Cloudflare does not accept GitHub's OIDC tokens, so deploying from GitHub Actions needs a long-lived Cloudflare API token as a repository secret.

## Decision

- The page is written in TypeScript and built with Vite, under `web/`.
- A crate `mblint-wasm` exposes `check` and `lint` through wasm-bindgen. It holds no logic of its own: it reads files from the map the page passes, calls the core, and returns the core's report.
- The reports the page receives are the JSON reports of the CLI, and the page's TypeScript types for them are generated from the core's Rust types.
- The page is a Worker serving static assets at mblint.shortarrow.jp. Workers Builds is connected to the repository, deploys `main`, and builds other branches as previews.
- The Workers Builds build command installs Rust and the `wasm-bindgen` command line before building the page.
- `main` changes only through pull requests whose CI passes, enforced by a ruleset, so the deployed commit is a tested one.

## Rationale

- One report format serves the CLI, the page and later the MCP server, so a diagnostic means the same thing in each.
- Types generated from the Rust types cannot drift from what the core returns, which hand-written TypeScript types or JSON decoders could.
- TypeScript draws the slot layout and the bus graph with the DOM and SVG directly.
- The page sits beside the owner's other sites, under the same domain and account.
- No Cloudflare credential is kept in GitHub.

## Alternatives not taken

- GitHub Pages, as ADR-0018 decided: a second place to keep sites, apart from the owner's others under shortarrow.jp.
- Deploying from GitHub Actions with Wrangler after CI: it needs a long-lived Cloudflare API token as a repository secret.
- Committing the built Wasm so that the build image needs no Rust: a build output in the repository can disagree with the source it came from.
- Elm, and a Rust front end such as Leptos, for the reasons in ADR-0018.

## Consequences

- Every build installs Rust, which adds minutes to each deployment.
- Pushing straight to `main` stops.

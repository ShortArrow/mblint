#!/usr/bin/env bash
# Builds the page in the Cloudflare Workers Builds image, which has Node.js but no Rust: installs Rust with the
# wasm32 target and the wasm-bindgen command line of the version in Cargo.lock, then builds the Wasm module and the page.
set -euo pipefail
cd "$(dirname "$0")/.."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --target wasm32-unknown-unknown
. "$HOME/.cargo/env"
version="$(bash scripts/wasm-bindgen-version.sh)"
release="wasm-bindgen-$version-x86_64-unknown-linux-musl"
curl --proto '=https' -sSfL "https://github.com/wasm-bindgen/wasm-bindgen/releases/download/$version/$release.tar.gz" |
  tar -xz -C "$HOME/.cargo/bin" --strip-components=1 "$release/wasm-bindgen"
npm run build:wasm
npm run build

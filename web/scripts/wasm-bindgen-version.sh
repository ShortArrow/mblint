#!/usr/bin/env bash
# Prints the version of the wasm-bindgen crate in Cargo.lock, which the wasm-bindgen command line must match.
set -euo pipefail
lock="$(dirname "$0")/../../Cargo.lock"
grep -A1 '^name = "wasm-bindgen"$' "$lock" | sed -n 's/^version = "\(.*\)"/\1/p'

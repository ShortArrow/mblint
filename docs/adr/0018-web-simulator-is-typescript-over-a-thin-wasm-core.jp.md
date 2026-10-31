# ADR-0018: Web シミュレーターは、コアの薄い Wasm ビルドの上に TypeScript で書いたページとする

[English](0018-web-simulator-is-typescript-over-a-thin-wasm-core.md)

- 状態: ADR-0019 により置き換え

## 文脈

ロードマップの Phase 3 は、`mblint-core` をブラウザで Wasm として動かす Web シミュレーターで、バックエンドを持たず、GitHub Pages か Cloudflare Pages に置く。コアはすべてのファイルを渡されたリーダー経由で読み、結果はすでに `mblint check --json` と `mblint lint --json` が定める JSON レポートとして出力できる。リポジトリは GitHub にあり、CI は GitHub Actions で動いている。

## 決定

- ページは TypeScript で書き、Vite でビルドし、`web/` に置く。
- クレート `mblint-wasm` が、wasm-bindgen で `check` と `lint` を公開する。このクレートは独自のロジックを持たず、ページが渡すマップからファイルを読み、コアを呼び、コアのレポートを返す。
- ページが受け取るレポートは CLI の JSON レポートとし、その TypeScript の型はコアの Rust の型から生成する。
- ページは GitHub Actions で GitHub Pages に公開する。

## 理由

- 一つのレポート形式が CLI、ページ、のちの MCP サーバーに共通するので、どこでも診断は同じ意味を持つ。
- Rust の型から生成した型は、コアが返すものとずれようがない。手書きの TypeScript の型や JSON デコーダーではずれうる。
- TypeScript なら、スロットの配置とバスのグラフを DOM と SVG で直接描ける。
- リポジトリと CI はすでに GitHub にあるので、Pages なら二つ目のアカウントが要らない。

## 採らなかった案

- Elm：状態の扱いはページに合うが、Wasm には JavaScript の ports を通してしか届かず、レポートの型をデコーダーとしてもう一度書くことになる。
- Leptos などの Rust のフロントエンド：言語は一つで済むが、ビルドが遅く、SVG を描く手段が少ない。
- Cloudflare Pages：静的なのは同じだが、アカウントと設定を保つサービスがもう一つ増える。

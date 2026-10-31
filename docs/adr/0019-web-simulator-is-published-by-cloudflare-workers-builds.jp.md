# ADR-0019: Web シミュレーターは、コアの薄い Wasm ビルドの上に TypeScript で書いたページとし、Cloudflare Workers Builds で mblint.shortarrow.jp に公開する

[English](0019-web-simulator-is-published-by-cloudflare-workers-builds.md)

- 状態: 採用

## 文脈

ADR-0018 は、ページ、Wasm のクレート、レポートの型を決め、ページを GitHub Pages に公開するとした。持ち主のほかの静的サイト、たとえば crc.shortarrow.jp は、shortarrow.jp の下で静的アセットを配る Cloudflare Workers で、それぞれのリポジトリから Workers Builds がビルドしている。Workers Builds は push されたブランチを CI を待たずに公開し、そのビルドイメージには Node.js はあるが Rust は無い。Cloudflare は GitHub の OIDC トークンを受け付けないので、GitHub Actions から公開するには、長命の Cloudflare の API トークンをリポジトリのシークレットに置くことになる。

## 決定

- ページは TypeScript で書き、Vite でビルドし、`web/` に置く。
- クレート `mblint-wasm` が、wasm-bindgen で `check` と `lint` を公開する。このクレートは独自のロジックを持たず、ページが渡すマップからファイルを読み、コアを呼び、コアのレポートを返す。
- ページが受け取るレポートは CLI の JSON レポートとし、その TypeScript の型はコアの Rust の型から生成する。
- ページは、mblint.shortarrow.jp で静的アセットを配る Worker とする。Workers Builds をリポジトリにつなぎ、`main` を公開し、ほかのブランチは preview としてビルドする。
- Workers Builds のビルドコマンドは、ページをビルドする前に Rust と `wasm-bindgen` コマンドラインを入れる。
- `main` は CI が通るプルリクエストでしか変えず、これをルールセットで強制する。これにより、公開される commit はテスト済みのものになる。

## 理由

- 一つのレポート形式が CLI、ページ、のちの MCP サーバーに共通するので、どこでも診断は同じ意味を持つ。
- Rust の型から生成した型は、コアが返すものとずれようがない。手書きの TypeScript の型や JSON デコーダーではずれうる。
- TypeScript なら、スロットの配置とバスのグラフを DOM と SVG で直接描ける。
- ページが、持ち主のほかのサイトと同じドメインとアカウントに並ぶ。
- GitHub に Cloudflare の認証情報を置かない。

## 採らなかった案

- ADR-0018 のとおり GitHub Pages に置く：shortarrow.jp の下にあるほかのサイトとは別に、サイトを置く場所がもう一つ増える。
- CI の後に GitHub Actions から Wrangler で公開する：長命の Cloudflare の API トークンをリポジトリのシークレットに置くことになる。
- ビルドイメージに Rust が要らないよう、ビルドした Wasm をコミットする：リポジトリにあるビルド出力が、その元のソースと食い違いうる。
- Elm と、Leptos などの Rust のフロントエンド：ADR-0018 の理由による。

## 結果

- ビルドのたびに Rust を入れるので、公開のたびに数分かかる。
- `main` へ直接 push することはやめる。

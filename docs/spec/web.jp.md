# Web シミュレーター

[English](web.md)

Web シミュレーターは、コアをブラウザで Wasm として動かす。ページは `web/` にある TypeScript で、Wasm モジュールはクレート `mblint-wasm` である。

## Wasm のインターフェース

モジュールは二つの関数を公開する。どちらも、読んでよいファイルを、パスからファイルの内容への対応を持つオブジェクトとして受け取る。パスは[データスキーマ](schema.jp.md)のパスの規則に従う。

| 関数 | 引数 | 戻り値 |
| --- | --- | --- |
| `check(files, rig)` | `files` と、rig ファイルのパス `rig` | [コマンドライン](cli.jp.md)にある `mblint check --json` のレポート |
| `lint(files, board)` | `files` と、ボードファイルのパス `board` | `mblint lint --json` のレポート |

ファイルは、CLI がデータルートの下から読むのと同じく、rig か呼び出しが名指すパスでだけ読む。`files` に無いパスは読めない。

ファイルを読み込めないときは、ファイル名とその理由を述べるメッセージ、つまり CLI が標準エラーで `mblint: ` に続けて出すメッセージを持つ `Error` を投げる。レポートは返さない。

## ページ

ページは、`data/` の下のすべてのファイルを、`data/` からのパスをキーとする `files` として持つ。その中のボードを一覧にし、選んだボードの lint のレポートとして、状態と各診断のメッセージを表示する。

## ビルド

Wasm モジュールは、`mblint-wasm` を `wasm32-unknown-unknown` 向けにビルドし、`wasm-bindgen` コマンドラインで TypeScript の宣言付きの ES モジュールにしたものである。コマンドラインは、`Cargo.lock` にある `wasm-bindgen` クレートと同じ版でなければならない。

ページは、`web/dist` の静的アセットを配る Cloudflare Worker として mblint.shortarrow.jp に公開する。設定は `web/wrangler.jsonc` にある。Cloudflare Workers Builds は `main` を公開し、ほかのブランチを preview としてビルドする。そのとき `web/scripts/cloudflare-build.sh` を実行し、ページをビルドする前に Rust と `wasm-bindgen` コマンドラインを入れる。

レポートの TypeScript の型は、コアの Rust の型から ts-rs で、型ごとに一つのファイルとして `web/src/report/` に生成する。`cargo test -p mblint-core --features ts` がこれを書き出し、そこにコミットされたファイルが書き出したものと異なるとき、CI は失敗する。各パスの診断の型は、パスの名前を冠して `PhysicalDiagnostic`、`LanesDiagnostic`、`TunnelsDiagnostic`、`ThroughputDiagnostic` と呼ぶ。

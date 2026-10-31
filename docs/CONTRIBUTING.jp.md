# mblint へのコントリビューション

[English](CONTRIBUTING.md)

## 言語

mblint はオープンソースプロジェクトです。コードコメント、docstring、コミットメッセージ、プルリクエストは英語で書いてください。

ドキュメントは英語で書き、日本語版を対にして置きます。

| 英語 | 日本語 |
| --- | --- |
| `README.md` | `docs/README.jp.md` |
| `docs/**/<name>.md` | 同じディレクトリの `docs/**/<name>.jp.md` |

英語版が原本です。対になる 2 つのファイルは同じコミットで変更し、片方だけが古い状態を説明することのないようにしてください。

## ライセンス

mblint は [MIT](../LICENSE-MIT) と [Apache-2.0](../LICENSE-APACHE) のいずれかを選択して利用できます。

明示的に別段の意思表示をしない限り、Apache-2.0 ライセンスの定義に従って mblint への取り込みを意図して提出されたあなたのコントリビューションは、追加の条項や条件なしに、上記のデュアルライセンスで提供されるものとします。

## 何をどこに書くか

| 問い | 置き場所 |
| --- | --- |
| 製品が何をすべきか | [`docs/prd.md`](prd.md) |
| データファイルに何を書き、パスがそれをどう評価するか | [`docs/spec/schema.md`](spec/schema.md)、[`docs/spec/passes.md`](spec/passes.md) |
| 設計判断をなぜ下したか | `docs/adr/NNNN-<title>.md`。書き方は[設計判断の記録](#設計判断の記録)のとおり |
| どの実在のボードを記述し、その値をどこから取るか | [`docs/reference-boards.md`](reference-boards.md) |
| まだ決まっていないこと | [`docs/spec/open-issues.md`](spec/open-issues.md) |
| インターフェースが何を保証するか | 型や関数の docstring |
| 個々の変更をなぜ行ったか | コミットメッセージに 1〜2 文で |

未決事項を解決した判断は、仕様書に書いて ADR に記録し、その項目を `open-issues.md` から削除します。

## 設計判断の記録

一つの判断を一つのファイル `docs/adr/NNNN-<title>.md` に書き、日本語版 `NNNN-<title>.jp.md` を対にして置きます。番号は採用した順に振ります。ファイルは次の部分から成ります。

| 部分 | 内容 |
| --- | --- |
| 題 | `ADR-NNNN: <判断を一文で>` |
| 状態 | `採用`、または `ADR-NNNN により置き換え` |
| 文脈 | 判断を必要とした事情 |
| 決定 | 何を決めたか |
| 理由 | なぜその案か |
| 採らなかった案 | 退けた案と、その理由 |
| 結果 | 判断から導かれること。何も無ければ省く |

ADR には日付を書きません。いつ採用されたか、その後どう変更されたかは、そのファイルに触れたコミットが記録しています。ファイルに日付を書くと、コミットの記録と食い違うことがあります。

採用した ADR は書き換えません。判断が置き換えられた後も、当時何が決まったかを読めるようにするためです。それを置き換える判断は新しい ADR とし、古い ADR は状態だけを `ADR-NNNN により置き換え` に変えます。

## 作業手順

変更は Red-Green-Refactor のサイクルで進めます。

1. 期待する振る舞いをテストに書き、失敗することを確かめる。
2. テストが通る最小の変更を書く。
3. すべてのテストが通る状態のままリファクタリングする。

構造の変更（rename、移動、抽出）と振る舞いの変更は、別のコミットにしてください。

プルリクエストを出す前に、CI がすべてのプルリクエストで実行する次の検査を実行してください。

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo test -p mblint-core --features ts export_bindings && test -z "$(git status --porcelain web/src/report)"
for board in data/boards/*/*.toml; do cargo run -q -p mblint -- lint --data-root data "${board#data/}"; done
(cd web && npm ci && npm run build:wasm && npm test && npm run build)
```

最後の行には、`wasm32-unknown-unknown` ターゲット（`rustup target add wasm32-unknown-unknown`）、`Cargo.lock` にある版の `wasm-bindgen` コマンドライン（`cargo install wasm-bindgen-cli --version <版>`）、Node.js 26 が必要です。

## リポジトリ構成

| パス | 内容 |
| --- | --- |
| `.cargo` | Cargo の設定。ts-rs がレポートの型を書き出す場所も決める |
| `.github/workflows` | CI。上の検査と、漏れたシークレットの走査を実行する |
| `crates/mblint` | `mblint` コマンドライン。コアのレポートを出力する |
| `crates/mblint-core` | トポロジーモデルと解決パス。CLI と Wasm ビルドで共有する |
| `crates/mblint-wasm` | Web シミュレーター向けの、コアの Wasm ビルド。コアのレポートを返す |
| `data/` | 基準ボードを収めるデータルート |
| `docs/` | 要求仕様、仕様書、ADR、未決事項 |
| `web/` | Web シミュレーターのページ。TypeScript で書く |
| `web/src/report` | コアから生成した、TypeScript 向けのレポートの型 |

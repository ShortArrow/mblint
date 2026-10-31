# Web シミュレーター

[English](web.md)

Web シミュレーターは、コアをブラウザで Wasm として動かす。ページは `web/` にある TypeScript で、Wasm モジュールはクレート `mblint-wasm` である。

## Wasm のインターフェース

モジュールは次の関数を公開する。どれも、読んでよいファイルを、パスからファイルの内容への対応を持つオブジェクトとして受け取る。パスは[データスキーマ](schema.jp.md)のパスの規則に従う。

| 関数 | 引数 | 戻り値 |
| --- | --- | --- |
| `check(files, rig)` | `files` と、rig ファイルのパス `rig` | [コマンドライン](cli.jp.md)にある `mblint check --json` のレポート |
| `lint(files, board)` | `files` と、ボードファイルのパス `board` | `mblint lint --json` のレポート |
| `catalog(files)` | `files` | 各ファイルが何であるか。[カタログ](#カタログ)のとおり |

ファイルは、CLI がデータルートの下から読むのと同じく、rig か呼び出しが名指すパスでだけ読む。`files` に無いパスは読めない。

ファイルを読み込めないときは、ファイル名とその理由を述べるメッセージ、つまり CLI が標準エラーで `mblint: ` に続けて出すメッセージを持つ `Error` を投げる。レポートは返さない。

## カタログ

`catalog(files)` は、`files` のすべてのパスをキーとし、そこにあるファイルが何であるかを値とするオブジェクトを返す。ファイルの種類は、パスではなく中身で決める。ボードとして解釈できればボード、デバイスとして解釈できればデバイス、rig として解釈できれば rig である。三つの必須フィールドは重ならないので、当てはまるのは多くとも一つである。

```json
{
  "boards/asus/proart_x870e_creator_wifi.toml": {
    "kind": "board", "vendor": "ASUS", "model": "ProArt X870E-CREATOR WIFI"
  },
  "devices/rtx_a400.toml": {
    "kind": "device", "name": "NVIDIA RTX A400 4GB", "type": "card",
    "interface": { "protocol": "pcie", "generation": 4, "lanes": 8 },
    "socket_category": "pcie_slot"
  },
  "rigs/workstation.toml": { "kind": "rig", "name": "workstation", "board": "boards/asus/proart_x870e_creator_wifi.toml" },
  "notes.toml": { "kind": "invalid", "message": "not a board: …; not a device: …; not a rig: …" }
}
```

| `kind` | フィールド |
| --- | --- |
| `board` | ボードの `vendor` と `model` |
| `device` | デバイスの `name` と `type`。デバイス自身のリンク `interface`（アダプタとディスプレイでは `null`）。装着するボードのソケットのカテゴリ `socket_category` |
| `rig` | rig の `name` と、そのボードのパス `board` |
| `invalid` | ボードでない理由、デバイスでない理由、rig でない理由を述べる `message` |

`socket_category` は、カードなら `pcie_slot`、M.2 モジュールなら `m2_slot`、ディスプレイなら `usb_c`、アダプタなら上流のコネクタに応じて `usb_c` か `usb_a` である。

## ページ

ページは、`data/` の下のすべてのファイルを、`data/` からのパスをキーとする `files` として持つ。その中のボードを一覧にし、選んだボードの lint のレポートとして、状態と各診断のメッセージを表示する。

## ビルド

Wasm モジュールは、`mblint-wasm` を `wasm32-unknown-unknown` 向けにビルドし、`wasm-bindgen` コマンドラインで TypeScript の宣言付きの ES モジュールにしたものである。コマンドラインは、`Cargo.lock` にある `wasm-bindgen` クレートと同じ版でなければならない。

ページは、`web/dist` の静的アセットを配る Cloudflare Worker として mblint.shortarrow.jp に公開する。設定は `web/wrangler.jsonc` にある。Cloudflare Workers Builds は `main` を公開し、ほかのブランチを preview としてビルドする。そのとき `web/scripts/cloudflare-build.sh` を実行し、ページをビルドする前に Rust と `wasm-bindgen` コマンドラインを入れる。

レポートの TypeScript の型は、コアの Rust の型から ts-rs で、型ごとに一つのファイルとして `web/src/report/` に生成する。`cargo test -p mblint-core --features ts` がこれを書き出し、そこにコミットされたファイルが書き出したものと異なるとき、CI は失敗する。各パスの診断の型は、パスの名前を冠して `PhysicalDiagnostic`、`LanesDiagnostic`、`TunnelsDiagnostic`、`ThroughputDiagnostic` と呼ぶ。

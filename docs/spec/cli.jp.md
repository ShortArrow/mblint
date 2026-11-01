# コマンドライン

[English](cli.md)

`mblint` バイナリは、解決パスで rig を評価し、ボードを lint します。

## `mblint check`

```sh
mblint check [--data-root <dir>] [--json] <rig>
```

| 引数 | 内容 |
| --- | --- |
| `<rig>` | rig のファイルの、データルートからの相対パス。`rigs/workstation.toml` など |
| `--data-root <dir>` | データルート。省略すると現在のディレクトリ |
| `--json` | レポートをテキストではなく JSON で出力する |

rig、そのボード、そのデバイスは、すべて rig が書くパスでデータルートの下から読みます。

### 終了ステータス

| ステータス | 意味 |
| --- | --- |
| 0 | rig を評価し、どのパスもエラーを報告しなかった。警告は報告されていることがある |
| 1 | rig を評価し、いずれかのパスがエラーを報告した |
| 2 | 引数が正しくない、ファイルのパスがパスの規則に反する、またはファイルを読めないか、スキーマに従っていない |

ファイルを読み込めないときは、そのファイルを示すメッセージを標準エラー出力に出し、`--json` の有無にかかわらず標準出力には何も出しません。

### テキスト出力

`--json` が無いときは、レポートを人向けに出力します。状態、各診断とそのメッセージ、実行されなかったパス、評価した各デバイスのリンクを含みます。テキストの書式は未規定です。スクリプトは `--json` を読みます。

### JSON 出力

`--json` があるときは、標準出力に 1 つの JSON オブジェクトを出します。

| フィールド | 内容 |
| --- | --- |
| `status` | エラーの診断があれば `"error"`、無く警告の診断があれば `"warning"`、どちらも無ければ `"ok"` |
| `passes` | `physical`（Pass 1）、`lanes`（Pass 2）、`tunnels`（Pass 3）、`throughput`（Pass 4）のそれぞれについて `"ran"` か `"not_run"` |
| `diagnostics` | 実行された各パスの診断。パスの順に並べ、パスの中ではそのパスが定める順に並べる |
| `links` | Pass 4 が評価した各デバイスのリンク。キーはソケットパス。Pass 4 が実行されなければ空 |

診断は次のフィールドと、コードごとのフィールドを持つオブジェクトです。

| フィールド | 内容 |
| --- | --- |
| `pass` | 報告したパス。`passes` と同じ名前 |
| `severity` | `"error"` か `"warning"`。パスの定めによる |
| `code` | 診断の名前を大文字のスネークケースにしたもの |
| `message` | 診断を説明する英語の文。文言は出力の取り決めに含まない |

| `code` | `pass` | フィールド |
| --- | --- | --- |
| `UNKNOWN_SOCKET` | `physical` | `socket` |
| `WRONG_SOCKET_CATEGORY` | `physical` | `socket` |
| `EDGE_TOO_WIDE` | `physical` | `socket`、`edge`、`slot`（`"x16"` などの幅） |
| `KEY_MISMATCH` | `physical` | `socket`、`slot`（スロットのキー。`"M"` など） |
| `OBSTRUCTED` | `physical` | `socket`、`by`（覆っているカードのソケット） |
| `NO_MATCHING_MODE` | `lanes` | `mux` |
| `SOCKET_DISABLED` | `lanes` | `socket`、`mux` |
| `PROTOCOL_UNSUPPORTED` | `lanes` | `socket`、`protocol`（`"sata"` など） |
| `LANE_OVERCOMMIT` | `lanes` | `root`、`supplied`、`demanded` |
| `DP_ALT_MODE_UNSUPPORTED` | `tunnels` | `socket` |
| `DP_LANES_INSUFFICIENT` | `tunnels` | `socket`、`required`、`available` |
| `USB_LIMITED_TO_USB2` | `tunnels` | `socket` |
| `DP_LANES_UNKNOWN` | `tunnels` | `socket` |
| `BOTTLENECK` | `throughput` | `socket`、`required_gbps`、`actual_gbps` |
| `UNRATED_LINK` | `throughput` | `socket` |
| `SHARED_IOMMU_GROUP` | `throughput` | `group`、`endpoints` |

リンクは `generation`、`lanes`、`gbps` を持つオブジェクトです。帯域の値は丸めません。

## `mblint lint`

```sh
mblint lint [--data-root <dir>] [--json] <board>
```

| 引数 | 内容 |
| --- | --- |
| `<board>` | ボードのファイルの、データルートからの相対パス。`boards/msi/mag_x870e_tomahawk_wifi.toml` など |
| `--data-root <dir>` | データルート。省略すると現在のディレクトリ |
| `--json` | レポートをテキストではなく JSON で出力する |

ボードは[ボードの lint](lint.jp.md) のとおりに検査します。終了ステータスは `mblint check` と同じで、「パスがエラーを報告した」を「lint がエラーを報告した」と読み替えます。読み込めないボードも同じように扱います。

`--json` を付けないと、レポートを人向けに出力します。状態と、すべての診断とそのメッセージです。テキストのレイアウトは未規定です。

`--json` を付けると、標準出力は一つの JSON オブジェクトになります。`mblint check` と同じ `status` と、lint が定める順の `diagnostics` を持ちます。診断は、`mblint check` と同じ `severity`、`code`、`message` と、コードごとのフィールドを持つオブジェクトです。

| `code` | フィールド |
| --- | --- |
| `INVALID_NODE_ID` | `node` |
| `UNKNOWN_PARENT` | `node`、`parent` |
| `INVALID_PARENT` | `node`、`parent` |
| `PARENT_CYCLE` | `nodes` |
| `UNKNOWN_MODE_TARGET` | `mux`、`node` |
| `FOREIGN_ALLOCATION` | `mux`、`node` |
| `UNREACHABLE_SOCKET` | `node` |
| `NO_MATCHING_MODE` | `mux`、`occupancy` |
| `LANE_OVERCOMMIT` | `root`、`supplied`、`demanded`、`occupancy` |

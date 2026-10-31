# 製品要求仕様書 (PRD): mblint (v2.0)

[English](prd.md)

## 1. エグゼクティブサマリー

`mblint`（プロジェクト表示名: `mb-lint`）は、PC 自作・ワークステーション・ハイパーバイザー（VFIO / PCI パススルー）構築における次の事項を決定論的に検証・モデル化するオープンソースの仕様検証ツールキットである。

- 物理スロットの干渉
- 内部バスの配線・分岐（PCIe Bifurcation / M.2 排他）
- プロトコル変換・トンネリング（USB4 / TB4 eGPU、USB-SATA / NVMe ブリッジ、DP Alt Mode）
- IOMMU グループの分離境界

端子ごとに個別のルールを書くのではなく、基板上のハードウェアを「リソース供給源（Root Provider）」「マルチプレクサ / スイッチ（Mux / Switch）」「プロトコル変換ブリッジ（Bridge）」「物理ソケット（Socket）」から成る単一の有向グラフとしてモデル化する。

ハードウェアのデータは宣言的な TOML として GitOps で管理する。純粋なグラフ探索・制約解決のロジックは共有コアライブラリ `mblint-core` に切り出す。この一つのコアから、人間向けの完全静的 Web 配線シミュレーターと、LLM エージェント向けの高速な CLI / MCP エンドポイントを、二重保守なしで提供する。

---

## 2. 解決する課題

1. **「端子」と「電気信号」の多重化**
   * **M.2 の多重人格性**: 同じスロットでも、挿すカード（PCIe NVMe / SATA SSD / OCuLink eGPU / Wi-Fi + BT）によって、消費するバス（PCIe / SATA / USB）や無効化されるもの（SATA ポートなど）が変わる。
   * **USB4 / TB4 トンネリング**: 40 Gbps の Type-C パイプの中で、DisplayPort 映像（優先確保）と PCIe トンネリング（eGPU / NVMe）が帯域を奪い合う。
   * **Type-C DP Alt Mode**: 4K / 60 Hz の非圧縮映像を出力すると、同じポートやその先のハブを経由する USB 通信が USB 2.0（480 Mbps）に強制的に落ちる。
2. **仮想化・PCI パススルー（IOMMU / VFIO）での道連れ**
   * 特定の USB コントローラやキャプチャカードだけを仮想マシンにパススルーしたいのに、PCH 配下の PCIe スイッチや SATA コントローラと同じ IOMMU グループに束ねられていて、単体で分離できない。
3. **物理・電気・論理の層が食い違い、組み立て後に発覚する**
   * 3 スロット厚の GPU が隣のスロットを塞ぐ、クローズドエンドの x4 スロットに x16 カードが入らない、x8 動作で GPU やキャプチャカードの帯域が半分になる、など。
4. **機械可読なトポロジーデータが無い**
   * メーカーのカタログや Web サイトにはグラフ構造が無く、AI やスクリプトが構成を決定論的に検証できない。

---

## 3. システムアーキテクチャとグラフ統一モデル

ハードウェア全体を、プロトコルを問わず次のノード種別から成る有向グラフとして抽象化する。

```text
[Node: Root Provider] (CPU レーン, PCH HSIO, USB ホスト, SATA ホスト)
         │
         ▼
[Node: Mux / Switch]  (Bifurcation IC, 排他スイッチ, PCIe パケットスイッチ)
         │
         ▼
[Node: Bridge]        (USB4 ホスト, USB-to-SATA/NVMe ブリッジ, DP Alt Mode Mux)
         │
         ▼
[Node: Socket]        (PCIe スロット, M.2 スロット, Type-C, Type-A, SATA ポート)
         │
         ▼ (装着)
[Node: Device]        (GPU, NVMe SSD, eGPU ボックス, ディスプレイ, USB ハブ)
```

独自の IOMMU グループを持つオンボードコントローラは、種別 `controller` のノードとする。

### システム構成図

```text
               ┌──────────────────────────────┐
               │    Hardware specs (TOML)     │
               │  - boards/*.toml             │
               │  - devices/*.toml            │
               │  - rigs/*.toml               │
               └──────────────┬───────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │         mblint-core          │
               │  - AST parser (TOML/JSON)    │
               │  - Universal topology graph  │
               │  - 4-pass resolution engine  │
               │  - Evaluator & linter        │
               └───────┬──────────────┬───────┘
                       │              │
       (native crate)  │              │  (Wasm compilation)
                       ▼              ▼
 ┌───────────────────────────┐  ┌───────────────────────────┐
 │          mblint           │  │        mblint-web         │
 │       (native CLI)        │  │       (static SPA)        │
 │ - Rich human output       │  │ - Static SPA (Workers)    │
 │ - AI output (--json)      │  │ - Client-side Wasm solver │
 │ - MCP server (stdio)      │  │ - Topology & slot visual  │
 └───────────────────────────┘  └───────────────────────────┘
```

---

## 4. データスキーマ仕様 (TOML v2.0)

### 4.1 マザーボード定義 (`boards/<vendor>/<model>.toml`)

```toml
schema_version = "2.0.0"
vendor = "Example"
model = "Example X870E"
source_manual = "https://example.com/manuals/example_x870e.pdf"
source_page = 32

[form_factor]
standard = "ATX"
total_slot_indices = 7

# --- 1. ルートリソース (Root Providers) ---
[nodes.root_cpu_peg]
type = "root"
domain = "CPU"
bus = "pcie"
lanes = 16
generation = 5

[nodes.root_cpu_gpp]
type = "root"
domain = "CPU"
bus = "pcie"
lanes = 4
generation = 4

[nodes.root_pch_hsio]
type = "root"
domain = "PCH"
bus = "hsio"
lanes = 12
generation = 4

# --- 2. スイッチ / Mux ---
[nodes.mux_peg_bifurcation]
type = "mux"
subtype = "bifurcation"
parent = "root_cpu_peg"

[[nodes.mux_peg_bifurcation.modes]]
when = { socket = "PCI_E2", is = "empty" }
allocate = { PCI_E1 = 16 }

[[nodes.mux_peg_bifurcation.modes]]
when = { socket = "PCI_E2", is = "occupied" }
allocate = { PCI_E1 = 8, PCI_E2 = 8 }

[nodes.mux_m2_sata_exclusive]
type = "mux"
subtype = "exclusive"
parent = "root_pch_hsio"

[[nodes.mux_m2_sata_exclusive.modes]]
when = { socket = "M2_2", is = "empty" }

[[nodes.mux_m2_sata_exclusive.modes]]
when = { socket = "M2_2", protocol = "pcie" }
allocate = { M2_2 = 4 }
disables = ["SATA_5", "SATA_6"]

[[nodes.mux_m2_sata_exclusive.modes]]
when = { socket = "M2_2", protocol = "sata" }

# --- 3. プロトコルブリッジ (Bridges) ---
[nodes.bridge_asm4242_usb4]
type = "bridge"
parent = "root_cpu_gpp" # PCIe Gen4 x4 接続
upstream_bus = "pcie"
upstream_lanes = 4
upstream_generation = 4
downstream_bus = "usb4"
max_throughput_gbps = 38.8 # USB4 40 Gbps を 128b/132b 符号化した後の値

# --- 4. 物理ソケット (Sockets) ---
[nodes.PCI_E1]
type = "socket"
category = "pcie_slot"
parent = "mux_peg_bifurcation"
slot_index = 2
physical_form_factor = "x16"
open_ended = false

[nodes.PCI_E2]
type = "socket"
category = "pcie_slot"
parent = "mux_peg_bifurcation"
slot_index = 4
physical_form_factor = "x16"
open_ended = false
iommu_group = 14

[nodes.M2_2]
type = "socket"
category = "m2_slot"
parent = "mux_m2_sata_exclusive"
key = "M"
supported_protocols = ["pcie", "sata"]
max_lanes = 4

[nodes.SATA_5]
type = "socket"
category = "sata_port"
parent = "root_pch_hsio"

[nodes.SATA_6]
type = "socket"
category = "sata_port"
parent = "root_pch_hsio"

[nodes.PORT_TYPEC_1]
type = "socket"
category = "usb_c"
parent = "bridge_asm4242_usb4"
supported_protocols = ["usb4", "usb3", "dp_alt_mode", "pcie_tunneling"]
dp_alt_max_lanes = 4

# --- 5. オンボードコントローラ (Controllers) ---
[nodes.ONBOARD_SATA_CONTROLLER]
type = "controller"
iommu_group = 14
```

---

### 4.2 デバイス / アダプタ定義 (`devices/...`)

#### 例1: eGPU ボックス（USB4 / TB4 → PCIe ブリッジ）

```toml
# devices/peripherals/razer_core_x.toml
schema_version = "2.0.0"
id = "razer_core_x"
name = "Razer Core X (eGPU Box)"
type = "adapter"

[upstream]
connector = "type_c"
protocol = "usb4"

[bridge]
chipset = "intel_jhl7440"
translates_to = "pcie"
max_tunneling_gbps = 31.5   # PCIe Gen3 x4

[downstream_sockets.EGPU_SLOT]
category = "pcie_slot"
physical_form_factor = "x16"
max_electrical_lanes = 4
generation = 3
```

#### 例2: USB3-SATA 変換アダプタ

```toml
# devices/peripherals/usb_sata_adapter.toml
schema_version = "2.0.0"
id = "jms578_usb_sata"
name = "USB 3.0 to SATA Bridge Adapter"
type = "adapter"

[upstream]
connector = "type_a"
protocol = "usb3_gen1x1"
max_gbps = 4.0           # 5 Gbps を 8b/10b 符号化した後の値

[bridge]
translates_to = "sata"
sata_generation = 3       # SATA 6 Gbps
```

#### 例3: 4K モニター（DP Alt Mode）

```toml
# devices/peripherals/u2723qe_monitor.toml
schema_version = "2.0.0"
id = "dell_u2723qe"
name = "Dell UltraSharp U2723QE"
type = "display"

[display]
resolution = "3840x2160"
refresh_rate = 60
dsc_supported = false
required_dp_lanes = 4      # 4 レーンすべてを映像に要求
bandwidth_requirement_gbps = 12.54
```

#### 例4: グラフィックスカード

```toml
# devices/cards/rtx_4090.toml
schema_version = "2.0.0"
id = "rtx_4090"
name = "NVIDIA GeForce RTX 4090 Founders Edition"
type = "card"

[interface]
protocol = "pcie"
generation = 4
lanes = 16                # 電気的なレーン数

[physical]
edge = "x16"              # カードエッジコネクタ
thickness_slots = 3       # 覆うブラケット位置の数。自身の位置を含む
length_mm = 304
```

#### 例5: M.2 SSD

```toml
# devices/ssds/crucial_t700.toml
schema_version = "2.0.0"
id = "crucial_t700"
name = "Crucial T700"
type = "m2_module"

[interface]
protocol = "pcie"
generation = 5
lanes = 4

[physical]
keys = ["M"]              # モジュールの切り欠き
form_factor = "2280"
```

---

### 4.3 構成インスタンス (`rigs/<name>.toml`)

アダプタの配下にさらにデバイスを挿す**ネストバインディング**に対応する。

```toml
schema_version = "2.0.0"
name = "AI & Video Editing Rig with eGPU"
board = "boards/example/example_x870e.toml"

[bindings]
# マザーボード直結のソケット
PCI_E1 = "devices/cards/rtx_4090.toml"
M2_2   = "devices/ssds/crucial_t700.toml"

# Type-C ポートに eGPU ボックスを接続
PORT_TYPEC_1 = "devices/peripherals/razer_core_x.toml"

# eGPU ボックスの内部スロットにセカンダリ GPU を挿す（ネスト接続）
"PORT_TYPEC_1.EGPU_SLOT" = "devices/cards/rtx_3060.toml"
```

---

## 5. コア判定パイプライン (`mblint-core`)

判定エンジンはグラフに対して次の 4 段階のパスを実行する。

```text
[Input: ボードグラフ + デバイス + ネストバインディング]
              │
              ▼
  【Pass 1: 物理レイヤー】
  ・コネクタ形状の整合（x16 カードを x4 スロットに挿していないか、Type-C / M-Key の整合）
  ・3 次元離散グリッド（ATX のスロット位置 1〜7、ブラケット、長さ、厚み）でのカード同士の重なり
              │ (合格なら次へ)
              ▼
  【Pass 2: 電気的な排他と Mux の解決】
  ・排他ルールの適用（例: M2_2 に PCIe SSD を挿したので SATA_5/6 ノードを無効化）
  ・Bifurcation の適用（PCI_E2 の占有を検知 -> PCI_E1 を x16 から x8 に分割）
  ・ルートプロバイダごとの総レーン数・HSIO 容量の収支
              │ (合格なら次へ)
              ▼
  【Pass 3: トンネリングとプロトコルブリッジ】
  ・Type-C Alt Mode の配分:
    - モニターが 4 レーンを消費 -> USB データ通信を USB 2.0 (480 Mbps) に強制フォールバック
  ・USB4 / TB4 トンネリングの帯域:
    - 40 Gbps パイプから DP 映像の帯域を優先して差し引き -> 残りを PCIe トンネリング（eGPU）に割り当て
  ・同じハブ配下での帯域の飽和（オーバーコミット）
              │ (合格なら次へ)
              ▼
  【Pass 4: 論理トポロジー・実効スループット・IOMMU】
  ・最終的なリンク（Gen、レーン数、プロトコル）から実効転送レート（Gbps）を算出
  ・デバイスの要求帯域に対するボトルネック警告
  ・IOMMU グループの分離境界: VFIO パススルー時に道連れになるデバイス群
              │
              ▼
[Output: EvaluationResult (status, warnings, errors, topology graph, IOMMU groups)]
```

---

## 6. コンポーネント機能要件

### 6.1 `mblint` (CLI)

1. **構成の検証 (`mblint check <rig.toml>`)**
   * 人間向け: PCIe / M.2 / USB の状態、実効帯域、フォールバックの理由、IOMMU グループをツリーとテーブルで表示する。
   * AI / スクリプト向け (`--json`)。4.3 の rig の場合:

     ```json
     {
       "status": "warning",
       "passes": {
         "physical": "ran",
         "lanes": "ran",
         "tunnels": "ran",
         "throughput": "ran"
       },
       "diagnostics": [
         {
           "pass": "throughput",
           "severity": "warning",
           "code": "BOTTLENECK",
           "socket": "M2_2",
           "required_gbps": 126.03076923076924,
           "actual_gbps": 63.01538461538462,
           "message": "M2_2 runs at 63.02 Gbps, below the 126.03 Gbps it requires."
         },
         {
           "pass": "throughput",
           "severity": "warning",
           "code": "BOTTLENECK",
           "socket": "PORT_TYPEC_1.EGPU_SLOT",
           "required_gbps": 252.06153846153848,
           "actual_gbps": 31.5,
           "message": "PORT_TYPEC_1.EGPU_SLOT runs at 31.50 Gbps, below the 252.06 Gbps it requires."
         }
       ],
       "links": {
         "M2_2": { "generation": 4, "lanes": 4, "gbps": 63.01538461538462 },
         "PCI_E1": { "generation": 4, "lanes": 16, "gbps": 252.06153846153848 },
         "PORT_TYPEC_1.EGPU_SLOT": { "generation": 3, "lanes": 4, "gbps": 31.5 }
       }
     }
     ```

2. **ボードの静的検証 (`mblint lint <board.toml>`)**
   * ボードのグラフ定義単体を静的解析し、レーン超過、閉路、到達不能なソケットを検出する。
3. **MCP サーバー (`mblint mcp`)**
   * LLM クライアント（Cursor、Claude Desktop など）が stdio 経由でトポロジーの探索と構成の診断を行える MCP ツールを提供する。

### 6.2 `mblint-web`

1. **完全静的ホスティング**
   * バックエンドを持たず、Cloudflare Workers が静的アセットとして mblint.shortarrow.jp で配る。
   * `mblint-core` を Wasm としてブラウザ内で実行する。
2. **対話型トポロジービジュアライザ**
   * 基板レイアウト（スロット、I/O パネル）と、その裏のバス配線グラフを切り替えて表示する。
   * eGPU ボックスや USB ハブなどネストした外部デバイスの接続と、それを通した帯域の変化を可視化する。
3. **BYO (Bring Your Own) データ**
   * 独自ボードや自作アダプタの TOML をページにドロップすると、その場で検証する。

---

## 7. 非機能要件

| 項目 | 要件 |
| --- | --- |
| **アーキテクチャの統一性** | PCIe、SATA、M.2、USB、TB4 をプロトコル別のコードパスで処理せず、一つのグラフ探索エンジンで扱う。 |
| **パフォーマンス** | CLI はネスト構成の評価を IOMMU グループの計算を含めて 20 ms 以内に終える。Web の Wasm 実行結果は即時に反映する。 |
| **移植性** | コアと CLI は Linux、macOS、Windows で単一バイナリとして動作する。 |
| **決定論性** | 同じ TOML 入力に対して、どの OS でも Wasm でも同じ評価結果を出力する。 |
| **GitOps 保守性** | ボード定義の追加・修正は GitHub のプルリクエストで行い、CI でレーン保存則（供給 ≥ 要求）を検証する。 |

---

## 8. ロードマップ

* **Phase 1: 統一グラフエンジンと AST**
  * Root、Mux、Bridge、Socket ノードによる有向グラフモデル
  * 4 段階パイプライン（物理グリッド → Mux 排他 → ブリッジ / トンネリング → IOMMU / スループット）
  * 代表的なボード（X870E、Z890）とネストアダプタ（eGPU、USB-SATA）のユニットテスト
* **Phase 2: CLI**
  * `mblint` CLI（`check`、`lint`、`--json`）
* **Phase 3: Web シミュレーター (Wasm)**
  * `mblint-core` の Wasm バインディング
  * グラフツリーとスロット配線ビジュアライザを備えた静的 SPA
* **Phase 4: GitOps 運用とデータ拡充**
  * プルリクエスト向けの GitHub Actions CI
  * 主要な上位マザーボード、人気のアダプタ・拡張カードの定義
* **Phase 5: MCP サーバー**（Web シミュレーターが成熟してから）
  * MCP サーバー（stdio 経由の LLM 連携）

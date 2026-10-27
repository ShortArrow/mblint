# データスキーマ

[English](schema.md)

mblint は、データルート（`boards/`、`devices/`、`rigs/` を含むディレクトリ）から 3 種類の TOML ファイルを読みます。どのファイルも `schema_version = "2.0.0"` を持ちます。

*厳格* と記したテーブルは、列挙していないフィールドを拒否します。それ以外のテーブルでは、列挙していないフィールドは受け付けて無視します。

## ボード

`boards/<vendor>/<model>.toml` は、BIOS が既定の設定のときのマザーボードを、ノードの有向グラフとして記述します。

| フィールド | 内容 |
| --- | --- |
| `vendor`、`model` | ボードを示す文字列 |
| `nodes.<id>` | 一つのノード。種別は `type` で示す |

ノード id は `.` を含みません。ルート以外のノードは、上流のノードを `parent` に書きます。

### ルート

`type = "root"` は、配下のノードに決まった数のレーンを供給する供給元です。

| フィールド | 内容 |
| --- | --- |
| `bus` | 供給するバス。`pcie`、`hsio` など |
| `lanes` | 供給するレーン数 |
| `generation` | リンクの世代 |

### Mux

`type = "mux"` は、どのソケットが埋まっているかによってレーンの割り当てが変わるスイッチです。

| フィールド | 内容 |
| --- | --- |
| `parent` | レーンを受け取るノード |
| `subtype` | `bifurcation` または `exclusive`。ハードウェアの説明であり、mode の評価方法は変わらない |
| `modes` | Mux の mode。優先する順に並べる |

mode は subtype によらず、どれも同じフィールドを持ちます。

| フィールド | 内容 |
| --- | --- |
| `when` | その mode が適用される条件 |
| `allocate` | 各ソケットまたはブリッジが Mux の親から受け取るレーン数。キーはその id。省略すると空 |
| `disables` | その mode の間は動作しなくなるソケット。省略すると空 |

`when` は厳格なテーブルで、次の 2 つの形のどちらかです。

```toml
when = { socket = "PCI_E2", is = "occupied" }   # または "empty"
when = { socket = "M2_2", protocol = "pcie" }
```

プロトコルの条件は、そのプロトコルで動作するデバイスがソケットに挿さっているときだけ成り立ちます。Mux の mode は、切り替えるソケットのすべての状態（空を含む）を網羅します。

### ブリッジ

`type = "bridge"` は、USB4 ホストコントローラのようなプロトコルブリッジです。

| フィールド | 内容 |
| --- | --- |
| `parent` | レーンを受け取るノード |
| `upstream_lanes` | 親がルートのときに受け取るレーン数 |

親が Mux のブリッジは、Mux が割り当てたレーンを受け取ります。

### コントローラ

`type = "controller"` は、SATA コントローラのように独自の IOMMU グループを持つオンボードコントローラです。`iommu_group` を持ちます。それ以外のフィールドは未規定です。

### ソケット

`type = "socket"` は、デバイスを挿す物理的なソケットです。フィールドは `category` によって決まります。

| `category` | 厳格 | フィールド |
| --- | --- | --- |
| `pcie_slot` | はい | `parent`、`slot_index`、`physical_form_factor`、`open_ended`（既定値 `false`）、`iommu_group` |
| `m2_slot` | はい | `parent`、`key`、`supported_protocols`、`max_lanes`、`iommu_group` |
| `sata_port` | はい | `parent`、`iommu_group` |
| `usb_c` | いいえ | `parent`、`dp_alt_max_lanes` |
| `usb_a` | いいえ | `parent` |

- `slot_index` は、ボード上のブラケット位置です。CPU から離れる向き、つまり ATX のカードのクーラーが張り出す向きに数えます。
- `physical_form_factor` は `x1`、`x4`、`x8`、`x16` のいずれかです。
- `open_ended` は、スロットの奥が開いていて、それより幅の広いカードエッジがはみ出して挿さることを表します。
- `key` は `B`、`E`、`M` のいずれかです。
- `dp_alt_max_lanes` は、そのポートが駆動できる DisplayPort Alt Mode のレーン数です。これが無いポートは DP Alt Mode を持ちません。
- `iommu_group` は省略できます。実機の `/sys/kernel/iommu_groups` で確認したグループ番号を書きます。

## プロトコル

プロトコルは `pcie`、`sata`、`usb4`、`usb3_gen1x1`、`displayport` のいずれかです。

## 帯域

帯域の値（名前が `_gbps` で終わるフィールド）は、回線符号化後かつプロトコルのオーバーヘッドを引く前のデータレートを Gbps で表します。1 レーンあたり 8 GT/s を 128b/130b 符号化で送る PCIe Gen3 x4 は `31.5`、5 Gbps を 8b/10b 符号化で送る USB 3 Gen 1 は `4.0` と書きます。

## デバイス

`devices/**/<id>.toml` は、一つのデバイスを記述します。

| フィールド | 内容 |
| --- | --- |
| `id`、`name` | デバイスを示す文字列 |
| `type` | `card`、`m2_module`、`adapter`、`display` のいずれか |

### カードと M.2 モジュール

カードと M.2 モジュールは、何で通信するかを `[interface]` に、何を占有するかを `[physical]` に書きます。どちらのテーブルも厳格です。

| テーブル | フィールド |
| --- | --- |
| `[interface]` | `protocol`、`generation`、`lanes`（電気的なレーン数） |
| カードの `[physical]` | `edge`（`x1`、`x4`、`x8`、`x16`）、`thickness_slots`、`length_mm` |
| M.2 モジュールの `[physical]` | `keys`、`form_factor`（`"2280"` など） |

- `thickness_slots` は、カードが覆うブラケット位置の数で、自分の位置を含み、1 以上です。位置の途中までの厚さは切り上げるので、3.5 スロットのカードは `4` と書きます。
- `keys` は、モジュールに切られた切り欠きの一覧です。B+M のモジュールは `["B", "M"]` と書きます。

カードと M.2 モジュールは、`[interface]` のリンクの帯域を要求します。

### アダプタ

アダプタは、ボードのソケットに挿さり、自分自身もソケットを持つデバイスです。

| テーブル | 厳格 | フィールド |
| --- | --- | --- |
| `[upstream]` | はい | `connector`（`type_c` または `type_a`）、ボードに向けて使う `protocol`、省略できる `max_gbps` |
| `[bridge]` | はい | `translates_to`（下流側のプロトコル）、省略できる `chipset`、`max_tunneling_gbps`、`sata_generation` |
| `[downstream_sockets.<NAME>]` | | `category` と、その category のフィールド。省略するとアダプタはソケットを持たない |

category が `pcie_slot` の下流ソケットは厳格で、`physical_form_factor`、`open_ended`（既定値 `false`）、`max_electrical_lanes`、`generation` を持ちます。

### 表示機器

表示機器は厳格な `[display]` テーブルを持ち、`displayport` で動作します。

| フィールド | 内容 |
| --- | --- |
| `resolution` | `"3840x2160"` のような文字列 |
| `refresh_rate` | リフレッシュレート（Hz） |
| `dsc_supported` | Display Stream Compression を受け付けるか |
| `required_dp_lanes` | その解像度とリフレッシュレートに必要な DisplayPort のレーン数 |
| `bandwidth_requirement_gbps` | 必要な映像のデータレート |

## Rig

`rigs/<name>.toml` は、一つの構成を記述します。

| フィールド | 内容 |
| --- | --- |
| `name` | rig を示す文字列 |
| `board` | ボードファイルのパス |
| `bindings` | 各ソケットに挿すデバイスファイルのパス。キーはソケットパス |

ファイルのパスはデータルートからの相対パスです。そのため、同じデバイスファイルはどの rig からも同じパスで指定します。

ソケットパスは、ボードのソケット id か、`<アダプタのパス>.<NAME>` です。後者は、そのパスに挿したアダプタのソケット `NAME` を指します。アダプタのパス自体がドット区切りでもよいので、アダプタは何段でも入れ子にできます。

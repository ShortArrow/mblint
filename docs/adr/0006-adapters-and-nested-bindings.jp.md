# ADR-0006: アダプタはソケットを公開し、rig はドット区切りのパスでそこに割り当てる

[English](0006-adapters-and-nested-bindings.md)

- 状態: 採用

## 文脈

eGPU ボックスや USB-SATA ケースは、ボードのソケットに装着され、それ自身もソケットを持つ。PRD は `[upstream]`、`[bridge]`、`[downstream_sockets]` を持つアダプタの例と、`"PORT_TYPEC_1.EGPU_SLOT"` のような rig の割り当てを示したが、その割り当ての解決方法、アダプタが収まるボードのソケット、アダプタ内のソケットの検査方法は決めていなかった。

## 決定

アダプタは `type = "adapter"` のデバイスとする。

| テーブル | フィールド |
| --- | --- |
| `[upstream]` | `connector`（`type_c` または `type_a`）、ボード側で使う `protocol`、省略可能な `max_gbps` |
| `[bridge]` | `translates_to`（下流側のプロトコル）、省略可能な `chipset`、`max_tunneling_gbps`、`sata_generation` |
| `[downstream_sockets.<NAME>]` | `category` とそのカテゴリの属性。省略時はソケットなし |

カテゴリ `pcie_slot` の下流ソケットは、`physical_form_factor`、`open_ended`（既定値 `false`）、`max_electrical_lanes`、`generation` を持つ。

rig は、`<アダプタのパス>.<NAME>` というキーでアダプタのソケットにデバイスを割り当てる。アダプタのパス自体もドット区切りでよく、アダプタは何段でも入れ子にできる。このため、ボードのノード id には `.` を含めない。

Pass 1 は、ボードのソケットにも下流ソケットにも同じ規則で収まるかを判定する。

| デバイス | 収まるソケット |
| --- | --- |
| `card` | 幅またはオープンエンドがエッジを受け入れる `pcie_slot` |
| `m2_module` | キーがモジュールの切り欠きに含まれる `m2_slot` |
| `connector = "type_c"` の `adapter` | `usb_c` ソケット |
| `connector = "type_a"` の `adapter` | `usb_a` ソケット |

パスがソケットに行き着かない割り当て（親のパスにアダプタが無い、またはアダプタにその名前のソケットが無い）は、存在しないソケットとして扱う。下流ソケットはボード上の位置を持たないので、覆い合いの検査はボードのスロット同士でだけ行う。

Pass 2 は、アダプタを、ボードのソケットで上流プロトコルを使うデバイスとして扱う。アダプタ内のデバイスはボードのレーンを消費しない。

## 理由

- 両方の種類のソケットに同じ規則を使えば、eGPU ボックス内のカードもボード上のカードと同じ検査を受ける。
- ドット区切りのパスは PRD の rig の例がすでに使っている書き方であり、ハブの中のハブにも新しい記法なしで広げられる。

## 採らなかった案

- アダプタごとに rig に `[nested]` テーブルを設ける: 同じ意味の割り当て記法が二つになる。

## 結果

アダプタを通る帯域（`max_gbps`、`max_tunneling_gbps`、`max_electrical_lanes`）は記録するが、まだ評価しない。それは Pass 3 と Pass 4 の役割である。

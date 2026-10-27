# ADR-0003: すべての Mux mode を同じ形にする

[English](0003-mux-modes-share-one-shape.md)

- 状態: 採用

## 文脈

PRD の草案は、bifurcation の mode を `allocate` で、exclusive の mode を `active_targets` と `cost_lanes` で書き、exclusive の mode はデバイスが使うプロトコルを条件にしていた。例では `SATA_5` と `SATA_6` を SATA mode の `active_targets` に挙げる一方、注記には PCIe mode で無効になるとあり、`active_targets` の意味がどちらにも読めた。また PRD は、プロトコルごとに別のコードパスで処理しないことを求めている。

## 決定

Mux の `subtype` にかかわらず、すべての mode は次のフィールドを持つ。

| フィールド | 意味 |
| --- | --- |
| `when` | その mode が適用される条件 |
| `allocate` | 各ソケットが Mux の親から受け取るレーン数。省略時は空 |
| `disables` | その mode の間は機能しなくなるソケット。省略時は空 |

`when` は次の 2 つの形のどちらかをとる。

```toml
when = { socket = "PCI_E2", is = "occupied" }   # または "empty"
when = { socket = "M2_2", protocol = "pcie" }   # または "sata"
```

プロトコル条件は、そのソケットに、そのプロトコルで動作するデバイスが装着されている間だけ成り立つ。

`subtype`（`bifurcation`、`exclusive`）は読み手にハードウェアを説明するためのもので、mode の評価方法は変えない。`active_targets` と `cost_lanes` は廃止し、`cost_lanes = 4` は `allocate = { M2_2 = 4 }` と書く。

Mux は、切り替える対象ソケットのすべての状態（空を含む）に対して mode を持たなければならない。持たない場合、解決時にどの mode も一致しないと報告される。

## 理由

- mode の形が一つなら、すべての Mux を一つの評価パスで扱える。
- `disables` は、利用者に警告すべき「失われるもの」を名指しし、読み方が一通りしかない。

## 採らなかった案

- subtype ごとのフィールド構成: 草案の記法を保てるが、subtype ごとに評価と検証が必要になる。

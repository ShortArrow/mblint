# PRD v2.0 の未決事項

[English](open-issues.md)

[PRD](../prd.jp.md) のうち、実装前に合意が必要な点。決まった点は `docs/spec/` の仕様書へ移し、この一覧から削除する。

影響の大きい順に並べる。

## スキーマ

| # | 節 | 未決の内容 |
| --- | --- | --- |
| 1 | 4.1 `modes[].when` | `when` は条件を一つだけ持つ。一つの mode に複数の条件を組み合わせる方法は未定。 |
| 3 | 4.2 / 5 Pass 4 | Pass 4 がデバイスの要求帯域をどこから読むかが未定。 |

## 例データの不整合

| # | 節 | 問題 |
| --- | --- | --- |
| 6 | 4.1 `mux_m2_sata_exclusive` | 例は、草案の注記に従って PCIe mode で `SATA_5` と `SATA_6` を無効にしている。実機が PCIe mode と SATA mode のどちらで無効にするかは、マニュアルで確認する必要がある。 |
| 7 | 6.1 JSON | RTX 3060（PCIe Gen4 x16）の `theoretical_max_gbps = 64.0` は、Gen4 x16（約 252 Gbps）とも Gen4 x8 とも一致しない。`PCI_E2` は 4.3 の rig で使われていない。 |
| 8 | 4.2 例1 | `max_tunneling_gbps = 32.0` を PCIe Gen3 x4 相当としているが、Gen3 x4 の実効レートは約 31.5 Gbps。帯域の値が生レートか回線符号化後の値かが定義されていない。 |

## 振る舞い

| # | 節 | 未決の内容 |
| --- | --- | --- |
| 10 | 4.1 `root_pch_hsio` | `bus = "hsio"` のレーンは PCIe、SATA、USB で共有される。`allocate` 以外に、ソケットが HSIO のレーンをいくつ消費するかを書く方法が無い。 |
| 11 | 4.1 `M2_2.supported_protocols` | M.2 スロットが対応しないプロトコルのモジュール（PCIe 専用スロットの SATA SSD など）を、どのパスで拒否するかが未定。物理的には収まるので、Pass 1 は報告しない。 |

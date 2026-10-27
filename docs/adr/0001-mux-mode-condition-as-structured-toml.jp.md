# ADR-0001: Mux の mode 条件は構造化 TOML で書く

[English](0001-mux-mode-condition-as-structured-toml.md)

- 状態: 採用

## 文脈

PRD の初稿は、Mux の mode 条件を `condition = "PCI_E2 == empty"` のような文字列式で書いていたが、その文法を定義していなかった。PRD はネイティブと Wasm のビルドで評価結果が一致する決定論性を要求しており、ボード定義はプルリクエストでレビューされ、誤りは CI で検出する必要がある。

## 決定

条件は文字列式ではなく、`when` という名前の TOML テーブルで書く。

```toml
[[nodes.mux_peg_bifurcation.modes]]
when = { socket = "PCI_E2", is = "occupied" }
allocate = { PCI_E1 = 8, PCI_E2 = 8 }
```

## 理由

- 条件の形がスキーマの型になるので、未知の状態はボードを読み込む時点で拒否できる。
- 式パーサを持たないので、ネイティブと Wasm で評価が分かれうる箇所が一つ減る。

## 採らなかった案

- 文字列 DSL: ボードファイルに初稿の記法を残せるが、文法、パーサ、エラー位置の報告をプロジェクトが自前で持つことになる。

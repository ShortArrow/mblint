# ADR-0012: ボードの PCIe スロットは、電気的なレーン数を書ける

[English](0012-board-pcie-slots-state-electrical-lanes.md)

- 状態: 採用

## 文脈

Pass 4 は、ボードのソケットのレーン数を Mux の `allocate` から、それが無ければ `max_lanes` から得る。`max_lanes` を持つのは `m2_slot` だけである。MSI MAG X870E TOMAHAWK WIFI では、どの PCIe スロットも Mux の下に無い。PCI_E1 は CPU に x16 で、PCI_E2 と PCI_E3 はチップセットに x1 と x4 で配線され、3 本とも x16 の長さのスロットである。こうしたスロットにはレーン数が無く、挿したカードはどれも、評価できないリンクとして報告されていた。アダプタの `pcie_slot` は、すでに `max_electrical_lanes` を持っている。

## 決定

- ボードの `pcie_slot` は、省略できる `max_electrical_lanes` を持つ。
- Pass 4 は、ボードの `pcie_slot` のレーン数を、Mux が割り当てたレーン数とし、割り当てが無ければ `max_electrical_lanes` とする。

## 理由

- スロットの電気的な幅は物理的な形状より狭いことが多いので、`physical_form_factor` からは導けない。
- フィールドの名前と意味は、アダプタの `pcie_slot` と同じである。

## 採らなかった案

- 各スロットを、固定の幅を割り当てる mode だけを持つ Mux の下に置く: Mux は切り替えを表すものであり、切り替えない Mux はボードを誤って記述する。
- `max_lanes` を流用する: PCIe スロットについては、アダプタがすでに使っている名前がこのスキーマでの用語である。

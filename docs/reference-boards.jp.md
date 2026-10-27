# 基準ボード

[English](reference-boards.md)

基準ボードは、このリポジトリのデータルート `data/boards/` の下に記述した実在のマザーボードです。テストはこれらのボードで rig を評価するので、スキーマとパスは、架空の例ではなく実在のボードに照らして保たれます。

## ボード

AM5 と LGA1851 のそれぞれについて、ASUS、ASRock、GIGABYTE、MSI から ATX のボードを 1 枚ずつ選びます。

| ソケット | メーカー | 型番 | ファイル |
| --- | --- | --- | --- |
| AM5 | MSI | MAG X870E TOMAHAWK WIFI | `data/boards/msi/mag_x870e_tomahawk_wifi.toml` |
| AM5 | ASUS | ProArt X870E-CREATOR WIFI | `data/boards/asus/proart_x870e_creator_wifi.toml` |
| AM5 | GIGABYTE | B850M D3HP | |
| AM5 | ASRock | X870 Taichi Creator | |
| LGA1851 | MSI | MAG Z890 TOMAHAWK WIFI | `data/boards/msi/mag_z890_tomahawk_wifi.toml` |
| LGA1851 | ASUS | ROG STRIX Z890-F GAMING WIFI | `data/boards/asus/rog_strix_z890_f_gaming_wifi.toml` |
| LGA1851 | GIGABYTE | Z890 AERO G | |
| LGA1851 | ASRock | Z890 Steel Legend WiFi | |

## 出典

- すべての値は、そのボードのメーカーによる英語版マニュアルから取ります。`source_manual` はその URL、`source_page` は拡張スロットとストレージを一覧にしたページです。各ノードの上のコメントに、値を読んだページを、マニュアルに印刷されたページ番号で書きます。
- ボードは、最も多くのレーンを使える CPU ファミリーを前提に記述し、そのファミリーをファイルの先頭のコメントに書きます。
- ソケットの id は、マニュアルがそのコネクタにつけた名前から `.` を除いたものとします。`M.2_1` は `M2_1` と書きます。
- マニュアルに書かれていない値は、推測せずに省きます。マニュアルの配置図から読んだスロットの位置は、書かれている値として扱います。
- マニュアルは供給量を書かないので、ルートの `lanes` は、マニュアルがそのルートから出ているとするレーン数の合計とします。
- `iommu_group` は、Linux 上でそのボードを観察した結果だけを書きます。

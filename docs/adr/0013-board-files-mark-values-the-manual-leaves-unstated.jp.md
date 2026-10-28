# ADR-0013: マニュアルが書いていない Type-C ポートの上流と DP Alt Mode のレーン数は、ボードのファイルで不明と書く

[English](0013-board-files-mark-values-the-manual-leaves-unstated.md)

- 状態: 採用

## 文脈

ボードのファイルは、すべての値をメーカーのマニュアルから取り、マニュアルが書いていない値は省く。基準ボードでは、次の 2 つの欠落が繰り返し現れた。

- ASUS ProArt X870E-CREATOR WIFI と ROG STRIX Z890-F GAMING WIFI のマニュアルは、USB4、Thunderbolt 4、USB Type-C のポートを挙げるが、どのルート、チップセット、コントローラからレーンを受け取るかを書かない。ソケットはすべて `parent` を書く必要があるので、これらのポートは省かれ、どちらのボードでも、Type-C ポートにアダプタや表示機器を割り当てる rig を書けなかった。
- MSI MAG X870E TOMAHAWK WIFI と MAG Z890 TOMAHAWK WIFI のマニュアル、および ASUS の 2 冊のマニュアルは、Type-C ポートが DisplayPort を出力すると書くが、レーン数を書かない。`dp_alt_max_lanes` の無いポートは DP Alt Mode を持たないので、Pass 3 はそうしたポートの表示機器を `DpAltModeUnsupported` と報告していた。これは Pass 4 を止めるエラーである。

`usb_c` と `usb_a` のソケットの `parent` を読むパスは無い。Pass 2 は Mux とブリッジを通してだけレーンを数え、Pass 3 は取り囲むアダプタでトンネルの上限を決め、Pass 4 は PCIe スロット、M.2 スロット、アダプタのソケットにある PCIe デバイスだけを評価する。

## 決定

- マニュアルが上流を書いていない `usb_c` と `usb_a` のソケットは、`parent = "unknown"` と書く。id が `unknown` のノードは無い。
- `dp_alt_max_lanes` は、レーン数か `"unknown"` をとる。`"unknown"` は、DP Alt Mode を持つがレーン数が書かれていないポートに使う。このフィールドが無いポートは、これまでどおり DP Alt Mode を持たない。
- Pass 3 は、`dp_alt_max_lanes` が `"unknown"` のポートにある表示機器を `DpLanesUnknown`（警告）と報告し、その表示機器についてそれ以外は検査しない。
- これにより、レーン数の書かれていない DisplayPort 対応の Type-C ポートが非対応と報告されるという未決事項が解決する。

## 理由

- アダプタや表示機器の物理的な適合と、DP Alt Mode の有無は、ポートの上流やレーン数が分からなくても検査できる。ポートを省くと、欠けた値に依存しない検査まで失われる。
- 明示的な `"unknown"` は、マニュアルを読んだうえで書かれていないという記述である。書き忘れたフィールドはそうではない。
- 必要なレーン数をポートと比べられない表示機器は、動かないとは分からないのでエラーではない。動くとも分からないので報告する。

## 採らなかった案

- Type-C と Type-A のソケットの `parent` を省略可能にする: 省いたフィールドと、書き忘れたフィールドを区別できない。
- `dp_alt_max_lanes` とは別に `dp_alt_mode = true` のようなフラグを設ける: `dp_alt_mode = false` とレーン数を同時に書くように、2 つのフィールドが矛盾しうる。
- Type-C コネクタが運べる最大の 4 レーンとみなす: 2 レーンしか駆動しないポートで `DpLanesInsufficient` を隠してしまう。
- USB4 コントローラを、親が不明なブリッジとして記述する: ブリッジは親から `upstream_lanes` を受け取るが、マニュアルはそれも書いていない。パスが読む値は、ポートだけですべて揃う。

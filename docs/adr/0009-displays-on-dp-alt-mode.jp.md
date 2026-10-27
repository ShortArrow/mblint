# ADR-0009: 表示機器は Type-C ポートに割り当て、そこから DP Alt Mode のレーンを受け取る

[English](0009-displays-on-dp-alt-mode.md)

- 状態: 採用

## 文脈

PRD の Pass 3 は Type-C の DisplayPort Alt Mode を検査する。4 レーンすべてを使うモニタは、ポートの USB データを USB 2.0 に落とす。PRD の表示機器の例は `type = "display"` と、`required_dp_lanes` と `bandwidth_requirement_gbps` を持つ `[display]` テーブルから成る。ボードの Type-C ポートは `dp_alt_max_lanes` と、`dp_alt_mode` を含む `supported_protocols` の一覧を持つ。表示機器がどのソケットに収まるか、Pass 2 でどのプロトコルで動くとみなすか、Pass 3 のどの指摘が Pass 4 を止めるかは、決まっていなかった。ドック、デイジーチェーン、USB4 でトンネルする DisplayPort にはまだスキーマが無く、表示機器を挿せるアダプタのソケットも無い。

## 決定

- 表示機器は `type = "display"` のデバイスとし、厳格な `[display]` テーブルに `resolution`、`refresh_rate`、`dsc_supported`、`required_dp_lanes`、`bandwidth_requirement_gbps` を持つ。
- 表示機器は `usb_c` ソケットに収まり、プロトコル `displayport` で動作する。
- `usb_c` ソケットは、駆動できる DP Alt Mode のレーン数を `dp_alt_max_lanes` に書く。これが無いポートは DP Alt Mode を持たない。`usb_c` ソケットの `supported_protocols` は引き続き検査しない。
- Pass 3 は、ボードの `usb_c` ソケットに挿した表示機器ごとに次を検査する。
  - ポートが DP Alt Mode を持たなければ、エラー `DpAltModeUnsupported`。
  - `required_dp_lanes` が `dp_alt_max_lanes` を超えれば、エラー `DpLanesInsufficient`。
  - 表示機器が 4 レーンを使えば、そのポートに USB 3 のデータ用のレーンが残らないので、警告 `UsbLimitedToUsb2`。
- Pass 3 のエラーは Pass 4 を止める。Pass 3 の警告は止めない。

## 理由

- 検査に必要なレーン数は `dp_alt_max_lanes` がすでに持っているので、プロトコル名の一覧をそれと一致させる必要が無い。
- 必要なレーンを得られない表示機器は、その解像度で映らないので、構成として動かない。USB 2.0 に落ちたポートは、遅くても動く。
- スキーマにある表示機器向けのソケットは Type-C だけなので、`usb_c` にだけ収まるとすれば、書けるすべての場合を扱える。

## 採らなかった案

- DP Alt Mode への対応を `supported_protocols` から読む: `usb3` や `pcie_tunneling` のように、一覧の名前はどのデバイスのプロトコルでもない。また、レーン数を書かずに `dp_alt_mode` だけを挙げたポートがありうる。
- `bandwidth_requirement_gbps` を今 DP のレーンと比べる: ポートの DisplayPort のリンクレート（HBR2、HBR3、UHBR）を書くフィールドが無く、仮定したレートに頼った比較になる。

## 結果

`bandwidth_requirement_gbps`、`resolution`、`refresh_rate`、`dsc_supported` は記録するが、まだ評価しない。USB4 のパイプから表示機器の帯域を差し引く処理は、表示機器が USB4 ポートにつながる経路となるドックやデイジーチェーンのスキーマを決めてから行う。

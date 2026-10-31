# ADR-0020: A device is added to the data when it has been in the top 20 of its category in the 価格.com ranking

[日本語](0020-reference-devices-are-those-in-the-top-20-of-a-kakaku-com-ranking.jp.md)

- Status: Accepted

## Context

The web simulator lists the devices under `data/devices/` as the parts a rig is built from, and no device had been described there. Describing every product is neither possible nor useful, so the data holds only devices that many people use; others are loaded into the page by their users. Which devices qualify has to be checkable by whoever reviews the change. Per-product sales are not published: Mindfactory's weekly unit sales cover one German retailer and come from a third party; BCN AWARD names the top vendor of each category, not products; the Steam Hardware Survey gives the share of GPU chips in use, not of products; Keepa's Amazon sales-rank history is paid; and shipment figures from Jon Peddie Research and the DigiTimes reports are per vendor or for the whole market.

## Decision

- A device is added to `data/devices/` when the product is within the top 20 of its category in 価格.com's 人気売れ筋ランキング, either on the day it is added or in a snapshot of that ranking kept by the Wayback Machine.
- The check is made for one device when its addition is requested; the archived rankings are not collected in bulk.
- The file records the ranking it was read from, as the day or the snapshot URL, with the category and the rank, in a comment.
- A device once added stays when its rank later falls.

## Rationale

- A rank and the day it was read can be checked by anyone reviewing the change, and a snapshot URL keeps pointing at the same page.
- The Wayback Machine holds the graphics card and motherboard rankings for 97 and 99 months from June 2008, so a product that sold well before its addition can still qualify.
- 価格.com ranks each category of PC parts separately.
- A product that has left the ranking is still in machines people check, so falling out is no reason to remove it.

## Alternatives not taken

- Sales or shipment figures: not published per product.
- The Steam Hardware Survey: graphics cards only, and per GPU chip, while a device file describes one product with its length and thickness.
- Keepa's sales-rank history: not checkable without a paid account.
- Design awards such as the Good Design Award: they judge design rather than use, and hardly any PC part has won one.

## Consequences

- A product that sold well only in months the Wayback Machine did not keep cannot be shown to qualify.
- Bulk collection is left out because it would send the Wayback Machine many requests in a short time, and each device needs its values checked against its specification by hand.
- Devices sold mainly outside Japan, and niche devices such as capture or serial cards, are rarely added; their users load them into the page.
- Whether 価格.com プロダクトアワード winners also qualify is left to a later decision.

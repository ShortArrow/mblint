# Reference devices

[日本語](reference-devices.jp.md)

Reference devices are real products described under `data/devices/`. The web simulator lists them as the parts a rig is built from. A device not described here is loaded into the page by its user.

## Which devices are described

A device is described when the product is within the top 20 of its category in 価格.com's 人気売れ筋ランキング, either on the day it is added or in a snapshot of that ranking kept by the Wayback Machine. The check is made for one device when its addition is requested. A device once described stays when its rank later falls.

No device is described yet.

## Sources

- A comment at the top of the file records the ranking it was read from, as the day or the snapshot URL (`https://web.archive.org/web/<timestamp>/…`), with the category and the rank.
- Every value comes from the vendor's specification for the product, whose URL is named in a comment at the top of the file.
- A product whose specification does not state a value the schema requires is not described.

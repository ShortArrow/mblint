# Reference boards

[日本語](reference-boards.jp.md)

Reference boards are real motherboards described under `data/boards/`, the data root of this repository. Tests evaluate rigs on them, so the schema and the passes are held to boards that exist rather than to invented examples.

## Boards

One ATX board from each of ASUS, ASRock, GIGABYTE and MSI for each of the sockets AM5 and LGA1851.

| Socket | Vendor | Model | File |
| --- | --- | --- | --- |
| AM5 | MSI | MAG X870E TOMAHAWK WIFI | `data/boards/msi/mag_x870e_tomahawk_wifi.toml` |
| AM5 | ASUS | ProArt X870E-CREATOR WIFI | `data/boards/asus/proart_x870e_creator_wifi.toml` |
| AM5 | GIGABYTE | B850M D3HP | |
| AM5 | ASRock | X870 Taichi Creator | |
| LGA1851 | MSI | MAG Z890 TOMAHAWK WIFI | `data/boards/msi/mag_z890_tomahawk_wifi.toml` |
| LGA1851 | ASUS | ROG STRIX Z890-F GAMING WIFI | `data/boards/asus/rog_strix_z890_f_gaming_wifi.toml` |
| LGA1851 | GIGABYTE | Z890 AERO G | |
| LGA1851 | ASRock | Z890 Steel Legend WiFi | |

## Sources

- Every value comes from the vendor's manual for the board, in English. `source_manual` is its URL and `source_page` the page that lists the board's expansion and storage. A comment above each node names the page it was read from, as printed in the manual.
- The board is described for the CPU family that gives it the most lanes, named in a comment at the top of the file.
- A socket's id is the name the manual gives its connector, with any `.` removed, so `M.2_1` is written `M2_1`.
- A value the manual does not state is left out rather than inferred. Slot positions read from the manual's layout diagram count as stated.
- A Type-C port whose upstream the manual does not state has `parent = "unknown"`, and one that the manual says outputs DisplayPort without giving a lane count has `dp_alt_max_lanes = "unknown"`.
- A root's `lanes` is the sum of the lanes the manual lists from that root, since manuals do not state a supply.
- `iommu_group` is written only from observation on the board under Linux.

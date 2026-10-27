# mb-lint

[日本語](docs/README.jp.md)

mblint checks a PC build against its motherboard before it is assembled. It models the board as one directed graph of lane providers, muxes, protocol bridges and sockets, and reports what a combination of cards and peripherals actually gets: slots that collide, lanes that are split or disabled, bandwidth lost to tunnelling, and devices that cannot be passed through to a VM alone because they share an IOMMU group.

Hardware is described in declarative TOML, so the same data drives a CLI for people and LLM agents and, later, a static web simulator.

## Status

Early development, Phase 1 of the [roadmap](docs/prd.md#8-roadmap). The core library `mblint-core` currently checks that each card and M.2 module fits its socket and that thick cards do not cover occupied slots, selects mux modes (PCIe bifurcation and M.2 / SATA exclusivity), reports devices in sockets those modes disable, and checks the lane balance of each root. It loads a rig with its board and devices, including devices installed inside adapters such as an eGPU box, and runs these checks as Passes 1 and 2. There is no CLI yet.

## Documentation

| Document | Contents |
| --- | --- |
| [Product requirements](docs/prd.md) | What mblint must do |
| [Data schema](docs/spec/schema.md) | The fields of board, device and rig files |
| [Resolution passes](docs/spec/passes.md) | What each pass checks and reports |
| [Open issues](docs/spec/open-issues.md) | What is still undecided |
| [Contributing](docs/CONTRIBUTING.md) | Language, workflow and where things are written |

## License

Licensed under either of [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.

# mb-lint

[日本語](docs/README.jp.md)

mblint checks a PC build against its motherboard before it is assembled. It models the board as one directed graph of lane providers, muxes, protocol bridges and sockets, and reports what a combination of cards and peripherals actually gets: slots that collide, lanes that are split or disabled, bandwidth lost to tunnelling, and devices that cannot be passed through to a VM alone because they share an IOMMU group.

Hardware is described in declarative TOML, so the same data drives a CLI for people and LLM agents and, later, a static web simulator.

## Status

Early development, Phase 1 of the [roadmap](docs/prd.md#8-roadmap). The core library `mblint-core` currently resolves PCIe bifurcation modes and checks the lane balance of each root. There is no CLI yet.

## Documentation

| Document | Contents |
| --- | --- |
| [Product requirements](docs/prd.md) | What mblint must do |
| [Architecture decisions](docs/adr/) | Why the schema and engine are shaped as they are |
| [Open issues](docs/spec/open-issues.md) | What is still undecided |
| [Contributing](docs/CONTRIBUTING.md) | Language, workflow and where things are written |

## License

Licensed under either of [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.

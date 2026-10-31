# mb-lint

[日本語](docs/README.jp.md)

mblint checks a PC build against its motherboard before it is assembled. It models the board as one directed graph of lane providers, muxes, protocol bridges and sockets, and reports what a combination of cards and peripherals actually gets: slots that collide, lanes that are split or disabled, bandwidth lost to tunnelling, and devices that cannot be passed through to a VM alone because they share an IOMMU group.

Hardware is described in declarative TOML, so the same data drives a CLI for people and LLM agents and, later, a static web simulator.

## Status

Early development, with Phases 1 and 2 of the [roadmap](docs/prd.md#8-roadmap) in place. The core library `mblint-core` currently checks that each card and M.2 module fits its socket and that thick cards do not cover occupied slots, selects mux modes (PCIe bifurcation and M.2 / SATA exclusivity), reports devices in sockets those modes disable, and checks the lane balance of each root. It loads a rig with its board and devices, including devices installed inside adapters such as an eGPU box, and runs these checks as Passes 1 and 2. Pass 3 checks that a monitor on a Type-C port gets the DP Alt Mode lanes it needs, warns when it leaves the port's USB data at USB 2.0, and caps PCIe links tunnelled through an adapter. Pass 4 reports each PCIe device's link rate, warning when it is below the rate of the device's own interface. Pass 4 also reports IOMMU groups in which an installed device shares its group with other devices or onboard controllers. [Reference boards](docs/reference-boards.md), real boards described from their manuals, are evaluated in the tests. The `mblint check` command evaluates a rig and prints the report for people or, with `--json`, for scripts, and `mblint lint` checks a board file on its own; see [Command line](docs/spec/cli.md).

## Documentation

| Document | Contents |
| --- | --- |
| [Product requirements](docs/prd.md) | What mblint must do |
| [Data schema](docs/spec/schema.md) | The fields of board, device and rig files |
| [Resolution passes](docs/spec/passes.md) | What each pass checks and reports |
| [Board lint](docs/spec/lint.md) | What lint checks in a board file on its own |
| [Command line](docs/spec/cli.md) | The `mblint` commands, their output and exit status |
| [Web simulator](docs/spec/web.md) | The Wasm interface the web page calls |
| [Open issues](docs/spec/open-issues.md) | What is still undecided |
| [Contributing](docs/CONTRIBUTING.md) | Language, workflow and where things are written |

## License

Licensed under either of [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.

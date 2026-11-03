import type { Loaded } from "./load";
import type { Files } from "./mblint";

/** A kind of file the page can create, by the name its new file is given. */
export type Template = "board" | "card" | "m2-module" | "adapter" | "display";

/** The smallest file of each kind the catalog reads, each required field holding an example value. */
export const TEMPLATES: Record<Template, string> = {
  board: `schema_version = "2.0.0"
vendor = "Vendor"
model = "New board"

[nodes.root_cpu]
type = "root"
bus = "pcie"
lanes = 16
generation = 4

[nodes.PCIE1]
type = "socket"
category = "pcie_slot"
parent = "root_cpu"
slot_index = 1
physical_form_factor = "x16"
`,
  card: `schema_version = "2.0.0"
id = "new_card"
name = "New card"
type = "card"

[interface]
protocol = "pcie"
generation = 4
lanes = 16

[physical]
edge = "x16"
thickness_slots = 2
length_mm = 250
`,
  "m2-module": `schema_version = "2.0.0"
id = "new_m2_module"
name = "New M.2 module"
type = "m2_module"

[interface]
protocol = "pcie"
generation = 4
lanes = 4

[physical]
keys = ["M"]
form_factor = "2280"
`,
  adapter: `schema_version = "2.0.0"
id = "new_adapter"
name = "New adapter"
type = "adapter"

[upstream]
connector = "type_c"
protocol = "usb4"

[bridge]
translates_to = "pcie"

[downstream_sockets.SLOT]
category = "pcie_slot"
physical_form_factor = "x16"
max_electrical_lanes = 4
generation = 3
`,
  display: `schema_version = "2.0.0"
id = "new_display"
name = "New display"
type = "display"

[display]
resolution = "3840x2160"
refresh_rate = 60
dsc_supported = false
required_dp_lanes = 4
bandwidth_requirement_gbps = 12.54
`,
};

/** A new file from `template`, named as `freeName` names a new file of that kind. */
export function newFile(files: Files, template: Template): Loaded {
  return { name: freeName(files, template), contents: TEMPLATES[template] };
}

/**
 * `new-<kind>.toml`, or `new-<kind>-<n>.toml` with the smallest `n` from 2 when that name is
 * taken under `local/` in `files`.
 */
function freeName(files: Files, kind: string): string {
  const free = (name: string) => !(`local/${name}` in files);
  let name = `new-${kind}.toml`;
  for (let n = 2; !free(name); n++) name = `new-${kind}-${n}.toml`;
  return name;
}

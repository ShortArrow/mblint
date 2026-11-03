import { describe, expect, it } from "vitest";
import { complete, faultPosition } from "./complete";
import board from "./report/board.schema.json";
import device from "./report/device.schema.json";
import rig from "./report/rig.schema.json";

/** The labels `complete` offers where `|` stands in `doc`. */
function offered(schema: object, doc: string): string[] {
  const pos = doc.indexOf("|");
  return complete(schema, doc.replace("|", ""), pos)?.options.map((o) => o.label) ?? [];
}

describe("complete", () => {
  it("offers the keys of the file's top level that are not yet written", () => {
    const keys = offered(board, 'schema_version = "2.0.0"\nve|');

    expect(keys).toEqual(expect.arrayContaining(["vendor", "model", "nodes"]));
    expect(keys).not.toContain("schema_version");
    expect(offered(rig, "|")).toEqual(expect.arrayContaining(["schema_version", "name", "board", "bindings"]));
  });

  it("offers the keys of the kind of node a table declares", () => {
    const keys = offered(board, '[nodes.PCIE1]\ntype = "socket"\ncategory = "pcie_slot"\n|');

    expect(keys).toEqual(expect.arrayContaining(["parent", "slot_index", "physical_form_factor", "open_ended"]));
    expect(keys).not.toContain("key");
    expect(keys).not.toContain("upstream_lanes");
  });

  it("offers the keys of an entry in an array of tables", () => {
    expect(offered(board, '[nodes.mux1]\ntype = "mux"\n\n[[nodes.mux1.modes]]\n|')).toEqual(
      expect.arrayContaining(["when", "allocate", "disables"]),
    );
  });

  it("offers the keys of a subtable of the device's type, and after a dotted key", () => {
    expect(offered(device, 'type = "card"\n\n[physical]\n|')).toEqual(
      expect.arrayContaining(["edge", "thickness_slots", "length_mm"]),
    );
    expect(offered(device, 'type = "m2_module"\nphysical.|')).toEqual(expect.arrayContaining(["keys", "form_factor"]));
  });

  it("offers the listed values of a field after =", () => {
    expect(offered(board, "[nodes.x]\ntype = |")).toEqual(['"root"', '"mux"', '"bridge"', '"socket"', '"controller"']);
    expect(offered(board, '[nodes.x]\ntype = "socket"\ncategory = "|')).toEqual(
      expect.arrayContaining(['"pcie_slot"', '"m2_slot"', '"usb_c"']),
    );
    expect(offered(device, 'type = "card"\n[interface]\nprotocol = |')).toContain('"pcie"');
  });

  it("offers the values of an array's items, and true and false for a flag", () => {
    expect(offered(board, '[nodes.m]\ntype = "socket"\ncategory = "m2_slot"\nsupported_protocols = ["pcie", |')).toContain('"sata"');
    expect(offered(board, '[nodes.s]\ntype = "socket"\ncategory = "pcie_slot"\nopen_ended = |')).toEqual(["true", "false"]);
  });

  it("starts the completion at the word being typed", () => {
    const doc = '[nodes.x]\ncategory = "pc';

    expect(complete(board, doc, doc.length)?.from).toBe(doc.length - 3);
  });

  it("offers nothing inside a table header, an inline table or a key it does not know", () => {
    expect(offered(board, "[nod|")).toEqual([]);
    expect(offered(board, "[nodes.x]\nwhen = { |")).toEqual([]);
    expect(offered(board, "[nodes.x]\nnot_a_key.|")).toEqual([]);
  });
});

describe("faultPosition", () => {
  it("takes the first line and column a message names", () => {
    expect(faultPosition("not a board: TOML parse error at line 3, column 7\n  |\n3 | x\n; at line 9, column 1")).toEqual({
      line: 3,
      column: 7,
    });
  });

  it("is null for a message naming no line", () => {
    expect(faultPosition("The text is longer than 1 MiB.")).toBeNull();
  });
});

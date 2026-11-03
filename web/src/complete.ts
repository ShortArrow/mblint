/** The part of a JSON Schema the completion reads. */
type Schema = {
  $ref?: string;
  $defs?: Record<string, Schema>;
  type?: string | string[];
  description?: string;
  properties?: Record<string, Schema>;
  additionalProperties?: Schema | boolean;
  items?: Schema;
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  const?: unknown;
  enum?: unknown[];
};

/** One completion offered: the text inserted, and the field's description. */
export type Option = { label: string; info?: string };

/** Simple values written in each table, keyed by the table's path joined with `.`. */
type Tables = Map<string, Map<string, string>>;

const HEADER = /^\s*\[\[?\s*(.*?)\s*\]\]?\s*(#.*)?$/;
const ASSIGNMENT = /^\s*([\w.-]+)\s*=\s*(?:"([^"]*)"|(true|false|-?\d+))/;

/** The segments of a dotted key, each without the quotes around it. */
function segments(key: string): string[] {
  return [...key.matchAll(/"([^"]*)"|'([^']*)'|([^.\s]+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!);
}

/** The simple values of every table in `lines`. */
function tables(lines: string[]): Tables {
  const found: Tables = new Map([["", new Map()]]);
  let table = "";
  for (const line of lines) {
    const header = HEADER.exec(line);
    if (header) {
      table = segments(header[1]!).join(".");
      if (!found.has(table)) found.set(table, new Map());
      continue;
    }
    const assignment = ASSIGNMENT.exec(line);
    if (assignment) {
      const path = segments(assignment[1]!);
      const key = [table, ...path.slice(0, -1)].filter(Boolean).join(".");
      if (!found.has(key)) found.set(key, new Map());
      found.get(key)!.set(path.at(-1)!, assignment[2] ?? assignment[3]!);
    }
  }
  return found;
}

function deref(root: Schema, schema: Schema): Schema | undefined {
  return schema.$ref === undefined ? undefined : root.$defs?.[schema.$ref.replace("#/$defs/", "")];
}

/** The constants an alternative fixes for its own keys, such as its `type`. */
function constants(root: Schema, schema: Schema): Map<string, unknown> {
  const own = Object.entries({ ...deref(root, schema)?.properties, ...schema.properties });
  return new Map(own.flatMap(([key, value]) => ("const" in value ? [[key, value.const]] : [])));
}

/**
 * The schemas whose properties hold in a table of `schema` that has the values `fixed`: `schema`,
 * what it refers to, and the alternatives that do not contradict `fixed`, or every alternative
 * when each contradicts it.
 */
function facets(root: Schema, schema: Schema, fixed: Map<string, string>): Schema[] {
  const target = deref(root, schema);
  const alternatives = [...(schema.oneOf ?? []), ...(schema.anyOf ?? [])];
  const fitting = alternatives.filter((alternative) =>
    [...constants(root, alternative)].every(([key, value]) => !fixed.has(key) || fixed.get(key) === value),
  );
  return [
    schema,
    ...(target ? facets(root, target, fixed) : []),
    ...(schema.allOf ?? []).flatMap((part) => facets(root, part, fixed)),
    ...(fitting.length ? fitting : alternatives).flatMap((alternative) => facets(root, alternative, fixed)),
  ];
}

/** The keys a table of `schema` with the values `fixed` may hold, each with its schema. */
function keys(root: Schema, schema: Schema, fixed: Map<string, string>): Map<string, Schema[]> {
  const found = new Map<string, Schema[]>();
  for (const facet of facets(root, schema, fixed)) {
    for (const [key, value] of Object.entries(facet.properties ?? {})) found.set(key, [...(found.get(key) ?? []), value]);
  }
  return found;
}

/** The schema of the value at `key` in a table of `schema` with the values `fixed`; an array's items when `entry`. */
function child(root: Schema, schema: Schema, key: string, fixed: Map<string, string>, entry: boolean): Schema | undefined {
  const named = keys(root, schema, fixed).get(key);
  const any = facets(root, schema, fixed).flatMap((facet) =>
    typeof facet.additionalProperties === "object" ? [facet.additionalProperties] : [],
  );
  const found = named ?? any;
  if (found.length === 0) return undefined;
  const value: Schema = found.length === 1 ? found[0]! : { anyOf: found };
  if (!entry) return value;
  const items = facets(root, value, new Map()).flatMap((facet) => (facet.items ? [facet.items] : []));
  return items.length ? { anyOf: items } : value;
}

/** The values listed for `schema`: its constants, its enumeration, and `true` and `false` for a flag. */
function values(root: Schema, schema: Schema): string[] {
  const found = facets(root, schema, new Map()).flatMap((facet) => [
    ...("const" in facet ? [facet.const] : []),
    ...(facet.enum ?? []),
    ...([facet.type].flat().includes("boolean") ? [true, false] : []),
  ]);
  return [...new Set(found.map((value) => (typeof value === "string" ? JSON.stringify(value) : String(value))))];
}

/**
 * What to offer at `pos` in the TOML text `doc` of a file that `schema` describes: the keys its
 * table may hold that are not yet written, or the listed values of the key being assigned, from the
 * start of the word being typed. `null` inside a table header or an inline table, or under a key the
 * schema does not know.
 */
export function complete(schema: object, doc: string, pos: number): { from: number; options: Option[] } | null {
  const root = schema as Schema;
  const lines = doc.slice(0, pos).split("\n");
  const line = lines.pop()!;
  if (/^\s*\[/.test(line) || line.includes("{")) return null;
  const header = [...lines].reverse().map((l) => HEADER.exec(l)).find(Boolean);
  const table = header ? segments(header[1]!) : [];
  const entry = header ? /^\s*\[\[/.test(header[0]) : false;
  const written = tables(doc.split("\n"));
  const fixedAt = (path: string[]) => written.get(path.join(".")) ?? new Map<string, string>();

  const equals = line.indexOf("=");
  const typed = equals < 0 ? /^\s*([\w.-]*)$/.exec(line)?.[1] : segments(line.slice(0, equals)).join(".");
  if (typed === undefined) return null;
  const dotted = segments(typed);
  const prefix = equals < 0 && !typed.endsWith(".") ? (dotted.pop() ?? "") : "";
  const key = equals < 0 ? null : dotted.pop()!;
  const path = [...table, ...dotted];

  let at: Schema | undefined = root;
  for (const [i, segment] of path.entries()) {
    at = child(root, at, segment, fixedAt(path.slice(0, i)), entry && i === table.length - 1);
    if (at === undefined) return null;
  }
  const fixed = fixedAt(path);

  if (key === null) {
    const present = new Set(fixed.keys());
    const options = [...keys(root, at, fixed)]
      .filter(([name]) => !present.has(name))
      .map(([name, schemas]) => ({ label: name, info: schemas.map((s) => s.description).find(Boolean) }));
    return { from: pos - prefix.length, options };
  }
  const value = line.slice(equals + 1);
  const inArray = value.trimStart().startsWith("[");
  const field = child(root, at, key, fixed, inArray);
  if (field === undefined) return null;
  const word = /"?[\w-]*$/.exec(value)![0];
  return { from: pos - word.length, options: values(root, field).map((label) => ({ label })) };
}

/** The first line and column, counted from 1, that a catalog message names; `null` if it names none. */
export function faultPosition(message: string): { line: number; column: number } | null {
  const found = /at line (\d+), column (\d+)/.exec(message);
  return found ? { line: Number(found[1]), column: Number(found[2]) } : null;
}

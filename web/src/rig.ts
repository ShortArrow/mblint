/** The rig file named `name`, `page` unless given, on `board` with `bindings`. */
export function rigToml(board: string, bindings: Record<string, string>, name = "page"): string {
  const lines = [
    'schema_version = "2.0.0"',
    `name = ${JSON.stringify(name)}`,
    `board = ${JSON.stringify(board)}`,
    "",
    "[bindings]",
    ...Object.entries(bindings).map(([socket, device]) => `${JSON.stringify(socket)} = ${JSON.stringify(device)}`),
  ];
  return `${lines.join("\n")}\n`;
}

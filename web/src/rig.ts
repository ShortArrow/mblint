/** The rig file the page builds, named `page`, on `board` with `bindings`. */
export function rigToml(board: string, bindings: Record<string, string>): string {
  const lines = [
    'schema_version = "2.0.0"',
    'name = "page"',
    `board = ${JSON.stringify(board)}`,
    "",
    "[bindings]",
    ...Object.entries(bindings).map(([socket, device]) => `${JSON.stringify(socket)} = ${JSON.stringify(device)}`),
  ];
  return `${lines.join("\n")}\n`;
}

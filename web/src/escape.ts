/** `text` as HTML text or a quoted attribute value, with `&`, `<`, `>`, `"` and `'` written as character references. */
export function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

import { autocompletion, completionKeymap, type CompletionContext } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { lintGutter, setDiagnostics } from "@codemirror/lint";
import { Annotation } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { classHighlighter } from "@lezer/highlight";
import { complete, faultPosition } from "./complete";
import board from "./report/board.schema.json";
import device from "./report/device.schema.json";
import rig from "./report/rig.schema.json";

const SCHEMAS: Record<string, object> = { board, device, rig };

/** The editor of one file's text, as the page drives it. */
export type CodeEditor = {
  /** Shows `text`, without reporting it as an edit. */
  show(text: string): void;
  /** The text being edited. */
  text(): string;
  /** Marks the line `message` names, or clears the mark when `message` is null. */
  mark(message: string | null): void;
};

const shown = Annotation.define<boolean>();

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "12px",
    color: "var(--ink)",
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: "6px",
  },
  "&.cm-focused": { outline: "2px solid var(--accent)", outlineOffset: "-1px" },
  ".cm-scroller": { fontFamily: '"JetBrains Mono", ui-monospace, monospace', lineHeight: "18px" },
  ".cm-gutters": { background: "var(--panel-2)", color: "var(--muted)", borderRight: "1px solid var(--line)" },
  ".cm-cursor": { borderLeftColor: "var(--ink)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    background: "color-mix(in srgb, var(--accent) 30%, transparent) !important",
  },
  ".cm-activeLine": { background: "transparent" },
  ".cm-tooltip": { background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { background: "var(--accent)", color: "#fff" },
  ".cm-completionInfo": { maxWidth: "320px", whiteSpace: "pre-wrap" },
});

/**
 * An editor of TOML text in `parent`, coloured as TOML, completing keys and listed values from
 * the JSON Schema of the kind of file `kind()` names (`board`, `device` or `rig`), and calling
 * `changed` after each edit the user makes.
 */
export function codeEditor(parent: HTMLElement, kind: () => string | null, changed: () => void): CodeEditor {
  const source = (context: CompletionContext) => {
    const of = SCHEMAS[kind() ?? ""];
    const found = of && complete(of, context.state.doc.toString(), context.pos);
    if (!found) return null;
    return {
      from: found.from,
      options: found.options.map(({ label, info }) => ({ label, info, type: label.startsWith('"') ? "enum" : "property" })),
      validFor: /^"?[\w-]*$/,
    };
  };
  const view = new EditorView({
    parent,
    extensions: [
      lineNumbers(),
      history(),
      StreamLanguage.define(toml),
      syntaxHighlighting(classHighlighter),
      autocompletion({ override: [source] }),
      lintGutter(),
      keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap]),
      EditorView.contentAttributes.of({ "aria-label": "Text of the file", spellcheck: "false" }),
      theme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !update.transactions.some((t) => t.annotation(shown))) changed();
      }),
    ],
  });
  return {
    show(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, annotations: shown.of(true) });
    },
    text: () => view.state.doc.toString(),
    mark(message) {
      const at = message === null ? null : faultPosition(message);
      if (at === null || message === null) {
        view.dispatch(setDiagnostics(view.state, []));
        return;
      }
      const line = view.state.doc.line(Math.min(at.line, view.state.doc.lines));
      view.dispatch(setDiagnostics(view.state, [{ from: line.from, to: line.to, severity: "error", message }]));
    },
  };
}

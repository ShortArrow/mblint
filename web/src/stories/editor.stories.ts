import { startCompletion } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import type { Meta, StoryObj } from "@storybook/html-vite";
import { codeEditor } from "../code";

const RIG = `# The workstation under the desk
schema_version = "2.0.0"
name = "desk"
board = "boards/a.toml" # the first board

[bindings]
PCIE1 = "devices/gpu.toml"
M2_1 = "devices/ssd.toml"
`;

type Args = { kind: "board" | "device" | "rig"; text: string; fault: string | null; complete: boolean };

/** The editor of a file of `kind` holding `text`, marking the line `fault` names and opening completion at the end when `complete`. */
const meta: Meta<Args> = {
  title: "Editor",
  args: { kind: "rig", text: RIG, fault: null, complete: false },
  argTypes: { kind: { control: "inline-radio", options: ["board", "device", "rig"] } },
  render: ({ kind, text, fault, complete }) => {
    const parent = document.createElement("div");
    parent.style.height = "320px";
    parent.style.maxWidth = "560px";
    const editor = codeEditor(parent, () => kind, () => {});
    editor.show(text);
    editor.mark(fault);
    if (complete) {
      requestAnimationFrame(() => {
        const view = EditorView.findFromDOM(parent.querySelector(".cm-editor") as HTMLElement)!;
        view.focus();
        view.dispatch({ selection: { anchor: view.state.doc.length } });
        startCompletion(view);
      });
    }
    return parent;
  },
};

export default meta;

type Story = StoryObj<Args>;

export const Highlighting: Story = {};

export const Fault: Story = { args: { fault: "TOML parse error at line 4, column 9" } };

export const Completion: Story = { args: { text: 'schema_version = "2.0.0"\nname = "desk"\nbo', complete: true } };

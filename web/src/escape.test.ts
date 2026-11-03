import { describe, expect, it } from "vitest";
import { escape } from "./escape";

describe("escape", () => {
  it("writes each character that could start markup or end an attribute as a reference", () => {
    expect(escape(`<img src=x onerror="a('b')">&`)).toBe("&#60;img src=x onerror=&#34;a(&#39;b&#39;)&#34;&#62;&#38;");
  });

  it("keeps any other text as it is", () => {
    expect(escape("ASRock X870 Taichi / PCIE1 — 1 MiB")).toBe("ASRock X870 Taichi / PCIE1 — 1 MiB");
  });
});

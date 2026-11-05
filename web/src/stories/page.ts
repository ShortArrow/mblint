import page from "../../index.html?raw";

const parsed = new DOMParser().parseFromString(page, "text/html");

/** A copy of the element of the page that `selector` finds, so that a story draws the page's own markup. */
export function fromPage(selector: string): HTMLElement {
  const found = parsed.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`index.html has nothing at ${selector}`);
  return found.cloneNode(true) as HTMLElement;
}

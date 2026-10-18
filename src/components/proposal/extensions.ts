import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (attrs: { factId: string; label: string }) => ReturnType;
    };
  }
}

/** Inline, non-editable chip that links a claim to a fact in the knowledge base. */
export const Citation = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      factId: { default: null, parseHTML: (el) => el.getAttribute("data-citation"), renderHTML: (a) => ({ "data-citation": a.factId }) },
      label: { default: "Source", parseHTML: (el) => el.getAttribute("data-label") ?? "Source", renderHTML: (a) => ({ "data-label": a.label }) },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-citation]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "cite-chip", contenteditable: "false", role: "button", tabindex: "0", title: `Source: ${node.attrs.label}` }),
      node.attrs.label,
    ];
  },
  addCommands() {
    return {
      insertCitation:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

/** Inline placeholder for a fact the agent could not find. Never a made-up value. */
export const Gap = Node.create({
  name: "gap",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      gapId: { default: null, parseHTML: (el) => el.getAttribute("data-gap"), renderHTML: (a) => ({ "data-gap": a.gapId }) },
      label: { default: "Missing fact", parseHTML: (el) => el.getAttribute("data-label") ?? "Missing fact", renderHTML: (a) => ({ "data-label": a.label }) },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-gap]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "gap-chip", contenteditable: "false", role: "button", tabindex: "0", title: "Answer this in the Questions panel" }),
      `Need: ${node.attrs.label}`,
    ];
  },
});

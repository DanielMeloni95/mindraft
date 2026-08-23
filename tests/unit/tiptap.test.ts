import { describe, expect, it } from "vitest";

import {
  docToMarkdown,
  docToPlainText,
  sectionsToDoc,
  textToDoc,
  type TipTapNode,
} from "@/lib/domain/tiptap";

const DOC: TipTapNode = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Visione" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Sapere " },
        { type: "text", text: "ogni lunedì", marks: [{ type: "bold" }] },
        { type: "text", text: " su cosa lavorare." },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Punteggio" }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Matrice" }] }],
        },
      ],
    },
  ],
};

describe("docToPlainText", () => {
  it("flattens the document for search and previews", () => {
    const text = docToPlainText(DOC);
    expect(text).toContain("Visione");
    expect(text).toContain("Sapere ogni lunedì su cosa lavorare.");
    expect(text).toContain("Punteggio");
  });

  it("tolerates rubbish instead of throwing", () => {
    expect(docToPlainText(null)).toBe("");
    expect(docToPlainText({ nope: true } as never)).toBe("");
  });
});

describe("docToMarkdown", () => {
  it("keeps headings, marks and lists", () => {
    const markdown = docToMarkdown(DOC);
    expect(markdown).toContain("## Visione");
    expect(markdown).toContain("**ogni lunedì**");
    expect(markdown).toContain("- Punteggio");
  });

  it("escapes nothing it should not and renders links", () => {
    const markdown = docToMarkdown({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Mindraft",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    });
    expect(markdown).toBe("[Mindraft](https://example.com)");
  });
});

describe("textToDoc", () => {
  it("turns paragraphs, headings and bullets into ProseMirror JSON", () => {
    const doc = textToDoc("# Titolo\n\nUn paragrafo.\n\n- uno\n- due");
    expect(doc.content?.[0].type).toBe("heading");
    expect(doc.content?.[1].type).toBe("paragraph");
    expect(doc.content?.[2].type).toBe("bulletList");
  });

  it("round-trips through markdown without losing the text", () => {
    const original = "Un paragrafo semplice.";
    expect(docToPlainText(textToDoc(original))).toBe(original);
  });
});

describe("sectionsToDoc", () => {
  it("builds the starting document from approved sections only", () => {
    const doc = sectionsToDoc([
      { title: "Problema", content: "Le idee sono sparse." },
      { title: "Soluzione", content: "" },
    ]);

    const text = docToPlainText(doc);
    expect(text).toContain("Problema");
    expect(text).toContain("Le idee sono sparse.");
    expect(text).toContain("Soluzione");
  });
});

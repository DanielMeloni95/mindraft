import { describe, expect, it } from "vitest";

import {
  bulletList,
  isOverwrite,
  parseCitations,
  parseSections,
  type ProposalSection,
} from "@/lib/domain/proposals";
import { defaultSelection } from "@/components/ai/diff-approval";

function section(overrides: Partial<ProposalSection> = {}): ProposalSection {
  return {
    key: "problem",
    label: "Problema",
    current: "",
    proposed: "Le idee sono sparse.",
    kind: "project_section",
    confidence: "medium",
    rationale: "",
    ...overrides,
  };
}

describe("proposal sections", () => {
  it("treats a section as an overwrite only when it replaces existing text", () => {
    expect(isOverwrite(section())).toBe(false);
    expect(isOverwrite(section({ current: "   " }))).toBe(false);
    expect(isOverwrite(section({ current: "Testo dell'utente" }))).toBe(true);
  });

  it("does not consider an identical value an overwrite", () => {
    expect(
      isOverwrite(section({ current: "Le idee sono sparse.", proposed: "Le idee sono sparse." })),
    ).toBe(false);
  });

  it("pre-selects only the sections that add something new", () => {
    const sections = [
      section({ key: "problem", current: "" }),
      section({ key: "solution", current: "La mia soluzione" }),
      section({ key: "users", current: "" }),
    ];

    const selected = defaultSelection(sections);

    expect(selected.has("problem")).toBe(true);
    expect(selected.has("users")).toBe(true);
    // Overwriting the user's own text is never opt-out.
    expect(selected.has("solution")).toBe(false);
  });

  it("survives malformed stored payloads", () => {
    expect(parseSections(null)).toEqual([]);
    expect(parseSections("not an array")).toEqual([]);
    expect(parseSections([{ nope: true }, null])).toEqual([]);
    expect(parseCitations(undefined)).toEqual([]);
  });

  it("keeps well-formed sections", () => {
    const stored = [section({ key: "vision" })];
    expect(parseSections(stored as never)).toHaveLength(1);
  });

  it("renders bullet lists the way the diff shows them", () => {
    expect(bulletList(["uno", "due"])).toBe("• uno\n• due");
  });
});

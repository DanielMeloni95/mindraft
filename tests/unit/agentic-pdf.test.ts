import { describe, expect, it } from "vitest";

import { agenticDocSectionTitles, agenticSectionCluster, buildAgenticStrategicMap, detectAgenticMapProfile, extractAgenticSectionTitles, pdfTextToAgenticDoc } from "@/lib/domain/agentic-template";

const SAMPLE = `AI EDITORIAL FACTORY
DOCUMENTO AGENTICO
DI PROGETTO
Descrizione del progetto.
PRINCIPIO GUIDA Gli agenti propongono, le persone decidono.
AI EDITORIAL FACTORY / DOCUMENTO AGENTICO 1.3
AI Editorial Factory 2 31 agosto 2026
1. Scopo, perimetro e stato
Testo introduttivo della sezione.
2. Principi non negoziabili
- Originale immutabile.
- Human in the loop.
3. Architettura applicativa
Monolite modulare.`;

describe("importazione PDF agentico", () => {
  it("seleziona la mappa specializzata tramite profilo dichiarativo", () => {
    expect(detectAgenticMapProfile("Workflow Editorial Factory")).toBe("editorial_factory");
    expect(detectAgenticMapProfile("Progetto generico")).toBeNull();
  });
  it("ricostruisce titolo, sezioni, callout e liste", () => {
    const doc = pdfTextToAgenticDoc(SAMPLE);
    expect(doc.content?.map((node) => node.type)).toContain("heading");
    expect(doc.content?.map((node) => node.type)).toContain("blockquote");
    expect(doc.content?.map((node) => node.type)).toContain("bulletList");
    const text = JSON.stringify(doc);
    expect(text).toContain("1. Scopo, perimetro e stato");
    expect(text).not.toContain("AI Editorial Factory 2 31 agosto 2026");
  });

  it("estrae le sezioni da trasformare in nodi canvas", () => {
    expect(extractAgenticSectionTitles(SAMPLE)).toEqual([
      "1. Scopo, perimetro e stato",
      "2. Principi non negoziabili",
      "3. Architettura applicativa",
    ]);
    expect(agenticDocSectionTitles(pdfTextToAgenticDoc(SAMPLE))).toEqual([
      "1. Scopo, perimetro e stato",
      "2. Principi non negoziabili",
      "3. Architettura applicativa",
    ]);
  });

  it("distribuisce le sezioni nei livelli tematici", () => {
    expect(agenticSectionCluster("1. Scopo, perimetro e stato").id).toBe("strategy");
    expect(agenticSectionCluster("4. Modello agentico").id).toBe("architecture");
    expect(agenticSectionCluster("10. Revisione umana").id).toBe("workflow");
    expect(agenticSectionCluster("15. Preflight e golden sample").id).toBe("quality");
    expect(agenticSectionCluster("18. Qualità e verifiche").id).toBe("governance");
    expect(agenticSectionCluster("21. Criteri di accettazione").id).toBe("delivery");
  });

  it("costruisce una gerarchia operativa per Editorial Factory", () => {
    const nodes = buildAgenticStrategicMap("AI Editorial Factory · Visual Studio · golden sample");
    expect(nodes.find((node) => node.key === "activities")?.parentKey).toBeUndefined();
    expect(nodes.find((node) => node.key === "p0")?.parentKey).toBe("activities");
    expect(nodes.find((node) => node.key === "p0-1")?.parentKey).toBe("p0");
    expect(nodes.find((node) => node.key === "r1")?.parentKey).toBe("result");
    expect(nodes.some((node) => node.label === "DECISIONI DA PRENDERE")).toBe(true);
  });
});

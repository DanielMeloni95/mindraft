import { describe, expect, it } from "vitest";

import { AGENTIC_SCHEMA_VERSION, buildAgenticMergePlan, managedAgenticBlock, parseAgenticDocument, type CurrentAgenticEntity } from "@/lib/domain/agentic-sync";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const DOCUMENT = "22222222-2222-4222-8222-222222222222";
const TASK_A = "33333333-3333-4333-8333-333333333333";
const TASK_B = "44444444-4444-4444-8444-444444444444";
const header = { schema_version: AGENTIC_SCHEMA_VERSION, project_id: PROJECT, document_id: DOCUMENT, document_revision: 7, exported_at: "2026-09-03T00:00:00.000Z" };
const current: CurrentAgenticEntity[] = [
  { id:TASK_A, entity_type:"task", revision:3, title:"Titolo uguale", status:"todo", priority:"medium" },
  { id:TASK_B, entity_type:"task", revision:5, title:"Titolo uguale", status:"todo", priority:"medium" },
];
const documentWith = (entities: Parameters<typeof managedAgenticBlock>[1]) => `# Narrativa\n\n${managedAgenticBlock(header, entities)}`;

describe("agentic-sync v1.1", () => {
  it("mantiene separate entità omonime con ID diversi", () => {
    const plan = buildAgenticMergePlan(documentWith([
      { id:TASK_A, entity_type:"task", revision:3, title:"Prima modificata", status:"todo", priority:"medium" },
      { id:TASK_B, entity_type:"task", revision:5, title:"Titolo uguale", status:"todo", priority:"medium" },
    ]), PROJECT, current);
    expect(plan.operations.map((op) => [op.key, op.outcome])).toEqual([[TASK_A,"update"],[TASK_B,"no-op"]]);
  });

  it("rende il secondo import dello stesso documento un NO-OP", () => {
    const markdown = documentWith([{ id:TASK_A, entity_type:"task", revision:3, title:"Prima modificata" }]);
    const first = buildAgenticMergePlan(markdown, PROJECT, current);
    const second = buildAgenticMergePlan(markdown, PROJECT, current, new Set([first.sourceHash]));
    expect(second.operations).toHaveLength(1);
    expect(second.operations[0].outcome).toBe("no-op");
  });

  it("produce CONFLICT per base revision obsoleta", () => {
    const plan = buildAgenticMergePlan(documentWith([{ id:TASK_A, entity_type:"task", revision:2, title:"Modifica vecchia" }]), PROJECT, current);
    expect(plan.operations[0].outcome).toBe("conflict");
  });

  it("non trasforma un ID sconosciuto in CREATE", () => {
    const plan = buildAgenticMergePlan(documentWith([{ id:"55555555-5555-4555-8555-555555555555", entity_type:"task", revision:1, title:"Esterna" }]), PROJECT, current);
    expect(plan.operations[0].outcome).toBe("review");
  });

  it("non interpreta l'assenza come eliminazione", () => {
    const plan = buildAgenticMergePlan(documentWith([]), PROJECT, current);
    expect(plan.operations).toEqual([]);
  });

  it("blocca ID duplicati e hash manomesso", () => {
    const markdown = documentWith([
      { id:TASK_A, entity_type:"task", revision:3, title:"Uno" },
      { id:TASK_A, entity_type:"task", revision:3, title:"Due" },
    ]).replace("Uno", "Alterato");
    const parsed = parseAgenticDocument(markdown);
    expect(parsed.errors.some((error) => error.includes("ID duplicato"))).toBe(true);
    expect(parsed.errors.some((error) => error.includes("Content hash"))).toBe(true);
  });

  it("accetta archiviazione solo con tombstone esplicita e revisione corretta", () => {
    const plan = buildAgenticMergePlan(documentWith([{ id:TASK_A, entity_type:"task", revision:3, intent:"archive", title:"Titolo uguale" }]), PROJECT, current);
    expect(plan.operations[0].outcome).toBe("archive");
  });

  it("crea una nuova entità solo quando l'ID è assente", () => {
    const plan = buildAgenticMergePlan(documentWith([{ entity_type:"task", title:"Nuova attività", status:"todo" }]), PROJECT, current);
    expect(plan.operations[0].outcome).toBe("create");
  });

  it("preserva la narrativa quando manca la sezione gestita", () => {
    const parsed = parseAgenticDocument("# Titolo\n\nTesto narrativo importante.");
    expect(parsed.entities).toEqual([]);
    expect(parsed.errors[0]).toContain("Sezione gestita");
  });

  it("blocca un documento appartenente a un altro progetto", () => {
    const plan = buildAgenticMergePlan(documentWith([]), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", current);
    expect(plan.valid).toBe(false);
    expect(plan.errors.join(" ")).toContain("altro progetto");
  });

  it("trasforma operazioni applicabili in conflitti se la revisione documento è obsoleta", () => {
    const plan = buildAgenticMergePlan(documentWith([{ id:TASK_A, entity_type:"task", revision:3, title:"Modificata" }]), PROJECT, current, new Set(), 8);
    expect(plan.operations[0].outcome).toBe("conflict");
    expect(plan.operations[0].reason).toContain("revisione 7");
  });

  it("fa round-trip del sottoinsieme gestito", () => {
    const entities = [{ id:TASK_A, entity_type:"task" as const, revision:3, title:"Titolo uguale", status:"todo", priority:"urgent" }];
    const parsed = parseAgenticDocument(documentWith(entities));
    expect(parsed.errors).toEqual([]);
    expect(parsed.entities).toEqual(entities);
  });
});

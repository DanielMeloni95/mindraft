import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const provision = readFileSync(join(root, "src/server/provision.ts"), "utf8");
const migration = readFileSync(join(root, "supabase/migrations/0019_project_scope_and_canvas_root.sql"), "utf8");
const canvasActions = readFileSync(join(root, "src/server/actions/canvas.ts"), "utf8");
const board = readFileSync(join(root, "src/components/canvas/canvas-board.tsx"), "utf8");

describe("ambito e nodo proprietario del canvas", () => {
  it("crea il nodo radice per progetto, sottoprogetto e strumento", () => {
    expect(provision).toContain('const rootVariant = params.entityKind === "tool"');
    expect(provision).toContain("root: true");
    expect(provision).not.toContain("if (params.parentProjectId) {\n    const { error: rootNodeError }");
  });

  it("recupera i canvas storici senza duplicare il nodo proprietario", () => {
    expect(migration).toContain("not exists");
    expect(migration).toContain("node.entity_id = canvas.project_id");
  });

  it("aggiunge un ambito libero e limitato in lunghezza", () => {
    expect(migration).toContain("context_scope text");
    expect(migration).toContain("between 1 and 80");
  });

  it("rifiuta l'eliminazione del nodo di origine sul server", () => {
    expect(canvasActions).toContain('(node.data as { root?: boolean } | null)?.root === true');
    expect(canvasActions).toContain("Il nodo di origine non si elimina");
  });

  it("toglie il nodo di origine dai percorsi di eliminazione del canvas", () => {
    expect(board).toContain("root: record.root === true");
    expect(board).toContain("deletable: !nodeMetadata(row.data).root");
    expect(board).toContain("{!selectedNode.data.root && <>");
    expect(board).toContain("if (node.data.root) continue;");
  });
});

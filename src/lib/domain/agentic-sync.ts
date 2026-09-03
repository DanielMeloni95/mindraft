import { z } from "zod";

export const AGENTIC_SCHEMA_VERSION = "1.1" as const;
export const MANAGED_START = "<!-- mindraft:managed:start";
export const MANAGED_END = "<!-- mindraft:managed:end -->";

export const syncEntityTypeSchema = z.enum(["goal", "milestone", "task", "decision", "risk", "resource", "canvas_node"]);
export type SyncEntityType = z.infer<typeof syncEntityTypeSchema>;
export type MergeOutcome = "create" | "update" | "conflict" | "archive" | "no-op" | "invalid" | "review";

const uuid = z.string().uuid();
const headerSchema = z.object({
  schema_version: z.literal(AGENTIC_SCHEMA_VERSION),
  project_id: uuid,
  document_id: uuid,
  document_revision: z.number().int().nonnegative(),
  exported_at: z.string(),
  source_hash: z.string().min(1),
});
const entitySchema = z.object({
  id: uuid.optional(),
  entity_type: syncEntityTypeSchema,
  revision: z.number().int().nonnegative().optional(),
  intent: z.enum(["upsert", "archive"]).optional(),
  title: z.string().trim().min(1).max(300),
  status: z.string().max(40).optional(),
  priority: z.string().max(40).optional(),
  description: z.string().max(8_000).optional(),
});

export type AgenticHeader = z.infer<typeof headerSchema>;
export type AgenticEntity = z.infer<typeof entitySchema>;
export type CurrentAgenticEntity = AgenticEntity & { id: string; revision: number; archived?: boolean };
export type MergeOperation = {
  key: string;
  outcome: MergeOutcome;
  imported: AgenticEntity | null;
  current: CurrentAgenticEntity | null;
  reason: string;
};
export type AgenticMergePlan = {
  valid: boolean;
  header: AgenticHeader | null;
  sourceHash: string;
  operations: MergeOperation[];
  errors: string[];
};

export function agenticHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function jsonComment(line: string, prefix: string): unknown {
  const raw = line.slice(prefix.length).replace(/-->\s*$/, "").trim();
  return JSON.parse(raw);
}

export function managedAgenticBlock(header: Omit<AgenticHeader, "source_hash">, entities: AgenticEntity[]): string {
  const body = entities.map((entity) => `<!-- mindraft:entity ${JSON.stringify(entity)} -->`).join("\n");
  const sourceHash = agenticHash(body);
  return `${MANAGED_START} ${JSON.stringify({ ...header, source_hash: sourceHash })} -->\n${body}\n${MANAGED_END}`;
}

export function parseAgenticDocument(markdown: string): { header: AgenticHeader | null; entities: AgenticEntity[]; sourceHash: string; errors: string[] } {
  const errors: string[] = [];
  const lines = markdown.replace(/\r/g, "").split("\n");
  const start = lines.findIndex((line) => line.trim().startsWith(MANAGED_START));
  const end = lines.findIndex((line, index) => index > start && line.trim() === MANAGED_END);
  if (start < 0 || end < 0) return { header: null, entities: [], sourceHash: "", errors: ["Sezione gestita Mindraft mancante o incompleta."] };
  let header: AgenticHeader | null = null;
  try {
    const parsed = headerSchema.safeParse(jsonComment(lines[start].trim(), MANAGED_START));
    if (parsed.success) header = parsed.data;
    else errors.push(`Metadata documento non validi: ${parsed.error.issues[0]?.message ?? "formato errato"}.`);
  } catch { errors.push("Metadata documento non sono JSON validi."); }
  const entities: AgenticEntity[] = [];
  const ids = new Set<string>();
  for (let index = start + 1; index < end; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith("<!-- mindraft:entity")) continue;
    try {
      const parsed = entitySchema.safeParse(jsonComment(line, "<!-- mindraft:entity"));
      if (!parsed.success) { errors.push(`Entità alla riga ${index + 1} non valida: ${parsed.error.issues[0]?.message}.`); continue; }
      if (parsed.data.id && ids.has(parsed.data.id)) { errors.push(`ID duplicato nel documento: ${parsed.data.id}.`); continue; }
      if (parsed.data.id) ids.add(parsed.data.id);
      entities.push(parsed.data);
    } catch { errors.push(`Metadata entità alla riga ${index + 1} non sono JSON validi.`); }
  }
  const body = lines.slice(start + 1, end).join("\n");
  const sourceHash = agenticHash(body);
  if (header && header.source_hash !== sourceHash) errors.push("Content hash non corrispondente: la sezione gestita è stata alterata fuori protocollo.");
  return { header, entities, sourceHash, errors };
}

export function buildAgenticMergePlan(markdown: string, expectedProjectId: string, current: CurrentAgenticEntity[], previousHashes: Set<string> = new Set(), expectedDocumentRevision?: number): AgenticMergePlan {
  const parsed = parseAgenticDocument(markdown);
  const operations: MergeOperation[] = [];
  if (parsed.header && parsed.header.project_id !== expectedProjectId) parsed.errors.push("Il documento appartiene a un altro progetto.");
  if (parsed.sourceHash && previousHashes.has(parsed.sourceHash)) {
    return { valid: parsed.errors.length === 0, header: parsed.header, sourceHash: parsed.sourceHash, errors: parsed.errors,
      operations: [{ key: "document", outcome: "no-op", imported: null, current: null, reason: "Documento già importato." }] };
  }
  const byId = new Map(current.map((entity) => [entity.id, entity]));
  parsed.entities.forEach((imported, index) => {
    const key = imported.id ?? `new:${index}`;
    if (!imported.id) { operations.push({ key, outcome: "create", imported, current: null, reason: "Nuova entità senza ID persistente." }); return; }
    const existing = byId.get(imported.id);
    if (!existing) { operations.push({ key, outcome: "review", imported, current: null, reason: "ID sconosciuto: richiede conferma, non viene creato automaticamente." }); return; }
    if (existing.entity_type !== imported.entity_type) { operations.push({ key, outcome: "invalid", imported, current: existing, reason: "L'ID appartiene a un tipo di entità diverso." }); return; }
    if (existing.archived && imported.intent !== "archive") { operations.push({ key, outcome: "conflict", imported, current: existing, reason: "L'entità è archiviata e non può essere riattivata implicitamente." }); return; }
    if (imported.revision !== existing.revision) { operations.push({ key, outcome: "conflict", imported, current: existing, reason: `Revisione obsoleta: documento ${imported.revision ?? "assente"}, Mindraft ${existing.revision}.` }); return; }
    if (imported.intent === "archive") { operations.push({ key, outcome: existing.archived ? "no-op" : "archive", imported, current: existing, reason: existing.archived ? "Già archiviata." : "Tombstone esplicita valida." }); return; }
    const changed = imported.title !== existing.title || (imported.status ?? "") !== (existing.status ?? "") || (imported.priority ?? "") !== (existing.priority ?? "") || (imported.description ?? "") !== (existing.description ?? "");
    operations.push({ key, outcome: changed ? "update" : "no-op", imported, current: existing, reason: changed ? "ID e revisione coincidono; modifica applicabile." : "Nessuna modifica semantica." });
  });
  if (parsed.header && expectedDocumentRevision !== undefined && parsed.header.document_revision !== expectedDocumentRevision) {
    for (const operation of operations) {
      if (["create", "update", "archive"].includes(operation.outcome)) {
        operation.outcome = "conflict";
        operation.reason = `Documento basato sulla revisione ${parsed.header.document_revision}; Mindraft è alla ${expectedDocumentRevision}.`;
      }
    }
  }
  return { valid: parsed.errors.length === 0 && !operations.some((op) => op.outcome === "invalid"), header: parsed.header, sourceHash: parsed.sourceHash, operations, errors: parsed.errors };
}

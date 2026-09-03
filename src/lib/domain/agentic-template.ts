import { textToDoc, type TipTapNode } from "@/lib/domain/tiptap";
import type { CanvasNodeType } from "@/types/database";

export type AgenticEntityKind = "project" | "subproject" | "tool";

export const AGENTIC_CANVAS_BLUEPRINT: Array<{
  section: string;
  label: string;
  type: CanvasNodeType;
  icon: string;
  x: number;
  y: number;
}> = [
  { section: "vision", label: "Visione", type: "goal", icon: "🔭", x: 0, y: 0 },
  { section: "objectives", label: "Obiettivi", type: "goal", icon: "🎯", x: 300, y: 0 },
  { section: "scope", label: "Perimetro", type: "feature", icon: "🧭", x: 600, y: 0 },
  { section: "roles", label: "Utenti e ruoli", type: "resource", icon: "👥", x: 0, y: 190 },
  { section: "agents", label: "Architettura agentica", type: "feature", icon: "🤖", x: 300, y: 190 },
  { section: "architecture", label: "Architettura tecnica", type: "feature", icon: "🏗️", x: 600, y: 190 },
  { section: "workflow", label: "Workflow", type: "feature", icon: "🔄", x: 0, y: 380 },
  { section: "data", label: "Dati e contratti", type: "resource", icon: "🗄️", x: 300, y: 380 },
  { section: "security", label: "Sicurezza e privacy", type: "risk", icon: "🔐", x: 600, y: 380 },
  { section: "roadmap", label: "Roadmap", type: "goal", icon: "🗺️", x: 0, y: 570 },
  { section: "acceptance", label: "Criteri di accettazione", type: "task", icon: "✅", x: 300, y: 570 },
  { section: "decisions", label: "Decisioni aperte", type: "decision", icon: "⚖️", x: 600, y: 570 },
];

export function agenticTemplateMarkdown(name: string, kind: AgenticEntityKind = "project"): string {
  const type = kind === "tool" ? "Strumento" : kind === "subproject" ? "Sottoprogetto" : "Progetto";
  return `# ${name} — Documento agentico

> Tipo: ${type}
> Versione: 1.0
> Stato: bozza operativa
> Principio guida: gli agenti propongono, le persone decidono.

## Come usare questo documento

Fonte primaria per prodotto, architettura, implementazione e verifica. Aggiornare decisioni, stato e prove a ogni iterazione significativa.

## 1. Visione e obiettivi

### Visione del prodotto

Descrivere il risultato futuro e il valore prodotto.

### Obiettivi

- Definire un risultato misurabile.
- Definire il primo incremento verificabile.

### Principi non negoziabili

- Human in the loop per decisioni sensibili o irreversibili.
- Output tracciabili, verificabili e versionati.
- Fallimento esplicito quando mancano dati o autorizzazioni.

## 2. Perimetro funzionale

### Capacità principali

- Descrivere le capacità incluse.

### Fuori perimetro

- Elencare ciò che non appartiene alla versione corrente.

## 3. Utenti e ruoli

- Owner / Admin — configurazione e decisioni finali.
- Operatore — esecuzione e revisione.
- Viewer — consultazione senza modifiche.

## 4. Architettura agentica

### Agenti e responsabilità

- Orchestrator — coordina stato, policy e passaggi.
- Specialist Agent — produce proposte strutturate nel proprio dominio.
- Validator — applica controlli deterministici.

### Stato e governance

- Definire stati, transizioni, pause, retry e approvazioni umane.

## 5. Architettura tecnica

### Componenti

- Interfaccia e API.
- Runtime agentico e workflow.
- Persistenza, integrazioni e osservabilità.

### Confini obbligatori

- Separare generazione AI, validazione deterministica e azioni autorizzate.
- Non esporre segreti al client, al modello o nei log.

## 6. Workflow end-to-end

1. Acquisire input e contesto.
2. Pianificare e validare il piano.
3. Eseguire per incrementi tracciabili.
4. Richiedere revisione o intervento umano.
5. Verificare criteri e produrre output.

## 7. Dati, contratti e integrazioni

### Entità principali

- Elencare entità, responsabilità e relazioni.

### Contratti

- Definire input, output, versionamento e provenienza.

### Integrazioni

- Elencare provider e adapter senza legare il core a un singolo fornitore.

## 8. Esperienza utente

- Descrivere navigazione, stati vuoti, errori, revisione e feedback.
- Rendere visibili stato degli agenti, evidenze e decisioni richieste.

## 9. Sicurezza, privacy e requisiti non funzionali

- Autorizzazione e isolamento dei dati.
- Protezione dei segreti e minimizzazione dei dati.
- Audit delle operazioni sensibili.
- Affidabilità, prestazioni, accessibilità e controllo dei costi.

## 10. Roadmap

- Fondazioni — modello dati, sicurezza e prima vertical slice.
- MVP — flusso end-to-end realmente verificabile.
- Espansione — nuovi agenti, adapter e automazioni.
- Hardening — qualità, osservabilità, recovery e scalabilità.

## 11. Attività

- Implementare la prima vertical slice.
- Aggiungere verifiche automatiche e istruzioni operative.

## 12. Criteri di accettazione

- Il flusso principale è dimostrabile end-to-end.
- Gli output includono evidenze e sono riproducibili.
- Le azioni sensibili richiedono policy e approvazione esplicita.
- Typecheck, lint, test e build sono verdi.

## 13. Definition of Done

- Funzionalità collegata al backend reale.
- Errori e stati limite gestiti.
- Sicurezza e autorizzazioni verificate.
- Documentazione e test aggiornati.

## 14. Protocollo operativo per l'agente

1. Ispezionare repository, vincoli e stato esistente.
2. Proporre un incremento verticale compatibile.
3. Implementare senza sostituire decisioni vincolanti.
4. Verificare e riportare risultato, test, limiti e prossimo passo.

## 15. Decisioni aperte

- Registrare decisione, alternative, raccomandazione e responsabile.

## 16. Canvas

${AGENTIC_CANVAS_BLUEPRINT.map((node) => `- ${node.label}`).join("\n")}

## 17. Glossario

- Agente — operatore specializzato con input e output validati.
- Gate — controllo deterministico o decisione umana che governa l'avanzamento.
- Evidenza — dato persistito che rende verificabile un risultato.

## 18. Controllo di versione

- 1.0 — creazione del documento agentico.
`;
}

export function buildAgenticTemplateDoc(name: string, kind?: AgenticEntityKind): TipTapNode {
  return textToDoc(agenticTemplateMarkdown(name, kind));
}

const PDF_RUNNING_HEADER = /^AI EDITORIAL FACTORY\s*\/\s*DOCUMENTO AGENTICO/i;
const PDF_RUNNING_FOOTER = /^AI Editorial Factory\s+\d+\s+/;

export function extractAgenticSectionTitles(text: string): string[] {
  const titles: string[] = [];
  let lastNumber = 0;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (PDF_RUNNING_HEADER.test(line) || PDF_RUNNING_FOOTER.test(line)) continue;
    const match = /^(\d{1,2})\.\s+(.{2,100})$/.exec(line);
    const number = match ? Number(match[1]) : 0;
    if (match && number > lastNumber) {
      titles.push(`${match[1]}. ${match[2]}`);
      lastNumber = number;
    }
  }
  return [...new Set(titles)].slice(0, 30);
}

export function agenticDocSectionTitles(doc: TipTapNode): string[] {
  const titles: string[] = [];
  let lastNumber = 0;
  for (const node of doc.content ?? []) {
    if (node.type !== "heading" || Number(node.attrs?.level ?? 0) !== 2) continue;
    const title = (node.content ?? []).map((child) => child.text ?? "").join("").trim();
    const match = /^(\d{1,2})\.\s+(.{2,100})$/.exec(title);
    const number = match ? Number(match[1]) : 0;
    if (match && number > lastNumber) {
      titles.push(title);
      lastNumber = number;
    }
  }
  return titles.slice(0, 30);
}

function textNode(text: string): TipTapNode[] {
  return text ? [{ type: "text", text }] : [];
}

/** Converts the line-oriented PDF.js output into semantic TipTap blocks. */
export function pdfTextToAgenticDoc(text: string): TipTapNode {
  const source = text.replace(/\r/g, "").replace(/\u0000/g, "").split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !PDF_RUNNING_HEADER.test(line) && !PDF_RUNNING_FOOTER.test(line));
  const content: TipTapNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    content.push({ type: "paragraph", content: textNode(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    content.push({
      type: "bulletList",
      content: bullets.map((item) => ({
        type: "listItem",
        content: [{ type: "paragraph", content: textNode(item) }],
      })),
    });
    bullets = [];
  };
  const flush = () => { flushParagraph(); flushBullets(); };

  const coverTitle = source.slice(0, 3).join(" ");
  let index = /DOCUMENTO AGENTICO/i.test(coverTitle) ? 3 : 0;
  let lastSectionNumber = 0;
  if (index) content.push({ type: "heading", attrs: { level: 1 }, content: textNode(coverTitle) });

  for (; index < source.length; index += 1) {
    const line = source[index];
    const heading = /^(\d{1,2})\.\s+(.{2,100})$/.exec(line);
    const sectionNumber = heading ? Number(heading[1]) : 0;
    if (heading && sectionNumber > lastSectionNumber) {
      flush();
      content.push({ type: "heading", attrs: { level: 2 }, content: textNode(`${heading[1]}. ${heading[2]}`) });
      lastSectionNumber = sectionNumber;
      continue;
    }
    if (/^[-•]\s+/.test(line)) {
      flushParagraph();
      bullets.push(line.replace(/^[-•]\s+/, ""));
      continue;
    }
    const callout = /^(PRINCIPIO GUIDA|DECISIONE DI PRODOTTO|INVARIANTE|LIMITE NOTO|STATO REALE|NOTA DI PRECISIONE|ATTIVITÀ UMANA NECESSARIA|WHITELIST DEL FORMATTER|OVERRIDE)\s*(.*)$/i.exec(line);
    if (callout) {
      flush();
      content.push({ type: "heading", attrs: { level: 3 }, content: textNode(callout[1]) });
      const body = [callout[2], source[index + 1] && !/^(\d{1,2})\.\s+/.test(source[index + 1]) ? source[++index] : ""]
        .filter(Boolean).join(" ");
      if (body) content.push({ type: "blockquote", content: [{ type: "paragraph", content: textNode(body) }] });
      continue;
    }
    if (line.length <= 80 && line === line.toLocaleUpperCase("it") && /[A-ZÀ-Ý]/.test(line)) {
      flush();
      content.push({ type: "heading", attrs: { level: 3 }, content: textNode(line) });
      continue;
    }
    if (bullets.length) {
      bullets[bullets.length - 1] += ` ${line}`;
      continue;
    }
    paragraph.push(line);
    if (/[.!?:]$/.test(line)) flushParagraph();
  }
  flush();
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

export function agenticSectionNode(title: string): { type: CanvasNodeType; icon: string } {
  const value = title.toLocaleLowerCase("it");
  if (/roadmap|obiettiv|scopo|perimetro/.test(value)) return { type: "goal", icon: "🎯" };
  if (/sicurezza|privacy|qualit|gate|preflight|risch/.test(value)) return { type: "risk", icon: "🛡️" };
  if (/criteri|definition|attivit/.test(value)) return { type: "task", icon: "✅" };
  if (/fonti|dati|artefatt|registry|glossario/.test(value)) return { type: "resource", icon: "🗄️" };
  if (/decision/.test(value)) return { type: "decision", icon: "⚖️" };
  return { type: "feature", icon: /agent|workflow/.test(value) ? "🤖" : "🧩" };
}

export type AgenticSectionCluster = {
  id: "strategy" | "architecture" | "workflow" | "quality" | "governance" | "delivery";
  label: string;
  icon: string;
};

export function agenticSectionCluster(title: string): AgenticSectionCluster {
  const number = Number(/^(\d{1,2})\./.exec(title)?.[1] ?? 0);
  if ([1, 2, 7].includes(number)) return { id: "strategy", label: "Visione e perimetro", icon: "🧭" };
  if (number >= 3 && number <= 6) return { id: "architecture", label: "Architettura e agenti", icon: "🏗️" };
  if (number >= 9 && number <= 12) return { id: "workflow", label: "Workflow e conoscenza", icon: "🔄" };
  if (number === 8 || (number >= 13 && number <= 16)) return { id: "quality", label: "Qualità e pubblicazione", icon: "✨" };
  if (number >= 17 && number <= 19) return { id: "governance", label: "Sicurezza e governance", icon: "🛡️" };
  return { id: "delivery", label: "Roadmap e tracciabilità", icon: "🗺️" };
}

export type AgenticStrategicNode = {
  key: string;
  parentKey?: string;
  label: string;
  type: CanvasNodeType;
  icon: string;
  color: string;
  x: number;
  y: number;
};

/** Declarative routing: adding a specialised map never requires changing parser logic. */
export const AGENTIC_MAP_PROFILES = [
  {
    id: "editorial_factory",
    requiredSignals: ["editorial factory", "golden sample", "visual studio"],
    minimumMatches: 1,
  },
] as const;

export function detectAgenticMapProfile(text: string): string | null {
  const normalized = text.toLocaleLowerCase("it");
  return AGENTIC_MAP_PROFILES.find((profile) =>
    profile.requiredSignals.filter((signal) => normalized.includes(signal)).length >= profile.minimumMatches,
  )?.id ?? null;
}

/**
 * Builds the decision-oriented map used by the canvas. The document remains the
 * source of detail; the canvas deliberately exposes the few things needed to
 * understand and operate the project instead of mirroring its table of contents.
 */
export function buildAgenticStrategicMap(text: string): AgenticStrategicNode[] {
  const profile = detectAgenticMapProfile(text);
  if (profile !== "editorial_factory") {
    return extractAgenticSectionTitles(text).map((label, index) => {
      const cluster = agenticSectionCluster(label);
      const style = agenticSectionNode(label);
      return {
        key: `section-${index}`,
        parentKey: `cluster-${cluster.id}`,
        label,
        type: style.type,
        icon: style.icon,
        color: "#eef2ff",
        x: index * 260,
        y: 520,
      };
    });
  }

  const group = (key: string, label: string, x: number, color: string): AgenticStrategicNode =>
    ({ key, label, type: "group", icon: "", color, x, y: 180 });
  const item = (key: string, parentKey: string, label: string, type: CanvasNodeType, x: number, y: number, color: string, icon = ""):
    AgenticStrategicNode => ({ key, parentKey, label, type, icon, color, x, y });

  const nodes: AgenticStrategicNode[] = [
    group("objectives", "OBIETTIVI", 0, "#dbeafe"),
    group("system", "SISTEMA", 1400, "#dff4ff"),
    group("decisions", "DECISIONI DA PRENDERE", 3000, "#fef3c7"),
    group("activities", "ATTIVITÀ DA FARE", 5200, "#dcfce7"),

    item("o1", "objectives", "O1 · Trasformare fonti tecniche in manuali e asset pubblicabili", "goal", -510, 500, "#dbeafe", "🎯"),
    item("o2", "objectives", "O2 · Garantire tracciabilità, qualità e controllo umano", "goal", -170, 500, "#dbeafe", "🎯"),
    item("o3", "objectives", "O3 · Adattare contenuti e visual al profilo del lettore", "goal", 170, 500, "#dbeafe", "🎯"),
    item("o4", "objectives", "O4 · Estendere la piattaforma a più volumi e collane", "goal", 510, 500, "#dbeafe", "🎯"),

    item("s1", "system", "Workflow agentico · Ingestione → Audit → Stesura → Revisione", "feature", 720, 500, "#dff4ff", "🔄"),
    item("s2", "system", "Agenti specializzati · Tecnico, Fonti, Struttura, Editoriale, Visual", "feature", 1060, 500, "#dff4ff", "🤖"),
    item("s3", "system", "Quality gate · Leakage, completezza, audience, visual, layout", "risk", 1400, 500, "#dff4ff", "🛡️"),
    item("s4", "system", "Revisione umana resiliente · fallback se manca il token di ripresa", "feature", 1740, 500, "#dff4ff", "👤"),
    item("s5", "system", "Artifact isolation · solo contenuti e asset approvati nel libro", "feature", 2080, 500, "#dff4ff", "📦"),
    item("s6", "system", "Pubblicazione · composizione → preflight → golden sample", "feature", 1060, 760, "#dff4ff", "📘"),
    item("s7", "system", "Sicurezza · Supabase, RLS, storage privato, audit", "risk", 1740, 760, "#dff4ff", "🔐"),

    item("d1", "decisions", "D1 · Approvare o correggere le revisioni dei capitoli 1–7", "decision", 2490, 500, "#fef3c7", "⚖️"),
    item("d2", "decisions", "D2 · Approvare gli asset nel Visual Studio", "decision", 2830, 500, "#fef3c7", "⚖️"),
    item("d3", "decisions", "D3 · Scegliere i render da promuovere a golden sample", "decision", 3170, 500, "#fef3c7", "⚖️"),
    item("d4", "decisions", "D4 · Definire priorità e perimetro della gestione delle collane", "decision", 3510, 500, "#fef3c7", "⚖️"),

    item("p0", "activities", "PRIORITÀ P0", "group", 4200, 500, "#dcfce7", "🔥"),
    item("p1", "activities", "PRIORITÀ P1", "group", 5400, 500, "#dcfce7", "📌"),
    item("p2", "activities", "PRIORITÀ P2", "group", 6500, 500, "#dcfce7", "🗓️"),
    item("p0-1", "p0", "Completare le figure dei capitoli 1, 2, 5, 6 e 7", "task", 3860, 800, "#dcfce7", "✅"),
    item("p0-2", "p0", "Approvare versioni e asset del pilota", "task", 4200, 800, "#dcfce7", "✅"),
    item("p0-3", "p0", "Rigenerare l’anteprima definitiva", "task", 4540, 800, "#dcfce7", "✅"),
    item("p0-4", "p0", "Eseguire Visual QA e preflight", "task", 3860, 1060, "#dcfce7", "✅"),
    item("p0-5", "p0", "Promuovere il golden sample", "task", 4200, 1060, "#dcfce7", "✅"),
    item("p0-6", "p0", "Rendere atomica la rigenerazione con una RPC transazionale", "task", 4540, 1060, "#dcfce7", "✅"),
    item("p1-1", "p1", "Configurare i provider AI per testo e immagini", "task", 5230, 800, "#dcfce7", "✅"),
    item("p1-2", "p1", "Completare gli agenti mancanti", "task", 5570, 800, "#dcfce7", "✅"),
    item("p1-3", "p1", "Consolidare il dataset di regressione", "task", 5230, 1060, "#dcfce7", "✅"),
    item("p1-4", "p1", "Realizzare la fase 8: UI e workflow per le collane", "task", 5570, 1060, "#dcfce7", "✅"),
    item("p2-1", "p2", "Implementare il disaster recovery", "task", 6160, 800, "#dcfce7", "✅"),
    item("p2-2", "p2", "Verificare backup e ripristino", "task", 6500, 800, "#dcfce7", "✅"),
    item("p2-3", "p2", "Preparare il runbook operativo", "task", 6840, 800, "#dcfce7", "✅"),
    item("result", "activities", "RISULTATO ATTESO", "group", 5400, 1360, "#ede9fe", "🏁"),
    item("r1", "result", "Manuale Dataform approvato", "goal", 4890, 1640, "#ede9fe", "🏁"),
    item("r2", "result", "Asset visuali completi", "goal", 5230, 1640, "#ede9fe", "🏁"),
    item("r3", "result", "PDF senza problemi bloccanti", "goal", 5570, 1640, "#ede9fe", "🏁"),
    item("r4", "result", "Pubblicazione tracciabile e sicura", "goal", 5910, 1640, "#ede9fe", "🏁"),
  ];
  return nodes;
}

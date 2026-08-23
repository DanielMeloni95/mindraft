import type {
  CanvasNodeType,
  DecisionStatus,
  EntityType,
  IdeaMaturity,
  IdeaStatus,
  MilestoneStatus,
  ProjectHealth,
  ProjectStatus,
  RelationType,
  SeverityLevel,
  TaskPriority,
  TaskStatus,
} from "@/types/database";

export type Descriptor<T extends string> = {
  value: T;
  label: string;
  /** Short explanation shown in tooltips and empty states. */
  hint?: string;
  /** Tailwind classes; colour is never the only signal, always paired with the label. */
  className: string;
};

function index<T extends string>(items: Descriptor<T>[]): Record<T, Descriptor<T>> {
  return items.reduce(
    (acc, item) => {
      acc[item.value] = item;
      return acc;
    },
    {} as Record<T, Descriptor<T>>,
  );
}

export const IDEA_STATUSES: Descriptor<IdeaStatus>[] = [
  {
    value: "inbox",
    label: "Inbox",
    hint: "Catturata, non ancora guardata",
    className: "bg-surface-muted text-muted-foreground border-border",
  },
  {
    value: "to_explore",
    label: "Da esplorare",
    hint: "Merita un secondo sguardo",
    className: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:border-brand-700",
  },
  {
    value: "analyzing",
    label: "In analisi",
    hint: "La stai valutando adesso",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
  },
  {
    value: "promising",
    label: "Promettente",
    hint: "Candidata a diventare progetto",
    className: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-800",
  },
  {
    value: "converted",
    label: "Convertita",
    hint: "È diventata un progetto",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
  },
  {
    value: "paused",
    label: "In pausa",
    className: "bg-surface-muted text-muted-foreground border-border",
  },
  {
    value: "discarded",
    label: "Scartata",
    hint: "Decisione registrata, non un fallimento",
    className: "bg-surface-muted text-subtle-foreground border-border line-through decoration-1",
  },
  {
    value: "archived",
    label: "Archiviata",
    className: "bg-surface-muted text-subtle-foreground border-border",
  },
];

export const IDEA_STATUS_MAP = index(IDEA_STATUSES);

export const IDEA_MATURITIES: Descriptor<IdeaMaturity>[] = [
  { value: "spark", label: "Scintilla", hint: "Una frase, niente di più", className: "bg-surface-muted text-muted-foreground border-border" },
  { value: "sketch", label: "Abbozzo", hint: "Problema o soluzione accennati", className: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:border-brand-700" },
  { value: "shaped", label: "Definita", hint: "Problema, soluzione e pubblico chiari", className: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-800" },
  { value: "validated", label: "Validata", hint: "Confermata da qualcosa di esterno", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800" },
];

export const IDEA_MATURITY_MAP = index(IDEA_MATURITIES);

export const PROJECT_STATUSES: Descriptor<ProjectStatus>[] = [
  { value: "idea", label: "Idea", className: "bg-surface-muted text-muted-foreground border-border" },
  { value: "exploration", label: "Esplorazione", className: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:border-brand-700" },
  { value: "validation", label: "Validazione", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800" },
  { value: "design", label: "Progettazione", className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-800" },
  { value: "development", label: "Sviluppo", className: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-800" },
  { value: "paused", label: "In pausa", className: "bg-surface-muted text-muted-foreground border-border" },
  { value: "completed", label: "Completato", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800" },
  { value: "archived", label: "Archiviato", className: "bg-surface-muted text-subtle-foreground border-border" },
];

export const PROJECT_STATUS_MAP = index(PROJECT_STATUSES);

export const PROJECT_HEALTHS: Descriptor<ProjectHealth>[] = [
  { value: "unknown", label: "Da valutare", className: "bg-surface-muted text-muted-foreground border-border" },
  { value: "on_track", label: "In carreggiata", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800" },
  { value: "at_risk", label: "A rischio", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800" },
  { value: "blocked", label: "Bloccato", className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800" },
];

export const PROJECT_HEALTH_MAP = index(PROJECT_HEALTHS);

export const TASK_STATUSES: Descriptor<TaskStatus>[] = [
  { value: "todo", label: "Da fare", className: "bg-surface-muted text-muted-foreground border-border" },
  { value: "in_progress", label: "In corso", className: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:border-brand-700" },
  { value: "blocked", label: "Bloccata", className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800" },
  { value: "done", label: "Completata", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800" },
];

export const TASK_STATUS_MAP = index(TASK_STATUSES);

export const TASK_PRIORITIES: Descriptor<TaskPriority>[] = [
  { value: "low", label: "Bassa", className: "bg-surface-muted text-muted-foreground border-border" },
  { value: "medium", label: "Media", className: "bg-surface-muted text-foreground border-border" },
  { value: "high", label: "Alta", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800" },
  { value: "urgent", label: "Urgente", className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800" },
];

export const TASK_PRIORITY_MAP = index(TASK_PRIORITIES);

export const DECISION_STATUSES: Descriptor<DecisionStatus>[] = [
  { value: "proposed", label: "Proposta", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800" },
  { value: "approved", label: "Approvata", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800" },
  { value: "superseded", label: "Superata", className: "bg-surface-muted text-subtle-foreground border-border" },
];

export const DECISION_STATUS_MAP = index(DECISION_STATUSES);

export const MILESTONE_STATUSES: Descriptor<MilestoneStatus>[] = [
  { value: "planned", label: "Pianificata", className: "bg-surface-muted text-muted-foreground border-border" },
  { value: "in_progress", label: "In corso", className: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:border-brand-700" },
  { value: "done", label: "Completata", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800" },
  { value: "canceled", label: "Annullata", className: "bg-surface-muted text-subtle-foreground border-border" },
];

export const MILESTONE_STATUS_MAP = index(MILESTONE_STATUSES);

export const SEVERITY_LEVELS: Descriptor<SeverityLevel>[] = [
  { value: "low", label: "Bassa", className: "bg-surface-muted text-muted-foreground border-border" },
  { value: "medium", label: "Media", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800" },
  { value: "high", label: "Alta", className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800" },
];

export const SEVERITY_MAP = index(SEVERITY_LEVELS);

export const RELATION_TYPES: Descriptor<RelationType>[] = [
  { value: "derives_from", label: "Deriva da", className: "" },
  { value: "depends_on", label: "Dipende da", className: "" },
  { value: "supports", label: "Supporta", className: "" },
  { value: "contradicts", label: "Contraddice", className: "" },
  { value: "part_of", label: "È parte di", className: "" },
  { value: "blocks", label: "Blocca", className: "" },
  { value: "replaces", label: "Sostituisce", className: "" },
  { value: "relates_to", label: "È correlato a", className: "" },
];

export const RELATION_MAP = index(RELATION_TYPES);

export const ENTITY_LABELS: Record<EntityType, string> = {
  inbox_item: "Elemento inbox",
  idea: "Idea",
  project: "Progetto",
  document: "Documento",
  goal: "Obiettivo",
  milestone: "Milestone",
  task: "Attività",
  decision: "Decisione",
  risk: "Rischio",
  resource: "Risorsa",
  canvas_node: "Nodo",
  note: "Nota",
};

/** Colour per node type. Always rendered together with the type label. */
export const CANVAS_NODE_STYLES: Record<
  CanvasNodeType,
  { label: string; accent: string; surface: string }
> = {
  idea: { label: "Idea", accent: "#5B5CE2", surface: "rgba(91,92,226,0.10)" },
  project: { label: "Progetto", accent: "#2DD4BF", surface: "rgba(45,212,191,0.12)" },
  note: { label: "Nota", accent: "#8D92AD", surface: "rgba(141,146,173,0.10)" },
  goal: { label: "Obiettivo", accent: "#16A34A", surface: "rgba(22,163,74,0.10)" },
  feature: { label: "Funzionalità", accent: "#6366F1", surface: "rgba(99,102,241,0.10)" },
  task: { label: "Attività", accent: "#0EA5E9", surface: "rgba(14,165,233,0.10)" },
  decision: { label: "Decisione", accent: "#A855F7", surface: "rgba(168,85,247,0.10)" },
  risk: { label: "Rischio", accent: "#E11D48", surface: "rgba(225,29,72,0.10)" },
  resource: { label: "Risorsa", accent: "#D97706", surface: "rgba(217,119,6,0.10)" },
  text: { label: "Testo", accent: "#6A6F8C", surface: "transparent" },
  group: { label: "Gruppo", accent: "#B4B9D4", surface: "rgba(180,185,212,0.08)" },
};

export const PROJECT_TEMPLATE_SECTIONS = [
  { key: "vision", title: "Visione" },
  { key: "problem", title: "Problema" },
  { key: "solution", title: "Soluzione" },
  { key: "users", title: "Utenti" },
  { key: "value", title: "Proposta di valore" },
  { key: "features", title: "Funzionalità" },
  { key: "flows", title: "Flussi" },
  { key: "architecture", title: "Architettura" },
  { key: "costs", title: "Costi" },
  { key: "roadmap", title: "Roadmap" },
  { key: "risks", title: "Rischi" },
  { key: "decisions", title: "Decisioni" },
  { key: "next", title: "Prossimi passi" },
] as const;

export type ProjectTemplateSectionKey =
  (typeof PROJECT_TEMPLATE_SECTIONS)[number]["key"];

import type { z } from "zod";

import { parseContext, type AiContext, type AiIdeaContext } from "./context";
import { AiError, type AiProvider, type AiRequest, type AiResponse } from "./provider";

/**
 * Deterministic local provider.
 *
 * This is not a stub that returns lorem ipsum: it applies real (if
 * simple) heuristics to the user's own text, so the whole Idea-to-Project
 * flow — proposals, per-section approval, undo — is exercisable without
 * an API key, and the end-to-end tests have a stable oracle. The UI
 * always labels the provider, so nobody mistakes it for a model.
 */

const PROBLEM_HINTS = [
  "problema", "perdo", "perdere", "non riesco", "fatica", "difficile", "spreco",
  "manca", "confus", "disordin", "dimentic", "caos", "troppo tempo",
];
const SOLUTION_HINTS = [
  "vorrei", "servirebbe", "potrei", "soluzione", "idea", "app", "strumento",
  "sistema", "piattaforma", "bot", "dashboard", "automat",
];
// Deliberately specific: a generic "per " matches half of any Italian
// sentence and would make the mock claim an audience that is not there.
const AUDIENCE_HINTS = [
  "per chi", "per le persone", "per i ", "per gli ", "per le ",
  "utenti", "clienti", "persone che", "team", "freelance", "studenti",
  "founder", "sviluppatori", "designer", "pubblico",
];

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function pick(list: string[], hints: string[]): string | null {
  const lower = hints.map((h) => h.toLowerCase());
  const found = list.find((s) => lower.some((h) => s.toLowerCase().includes(h)));
  return found ?? null;
}

function titleFrom(text: string): string {
  const first = sentences(text)[0] ?? text;
  const words = first.split(/\s+/).slice(0, 8).join(" ");
  const clean = words.replace(/[.,;:]$/, "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function bulletsFrom(text: string): string[] {
  const explicit = text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((l) => l.length > 8);
  if (explicit.length > 1) return explicit.slice(0, 8);
  return sentences(text).slice(0, 6);
}

function keywords(text: string): string[] {
  const stop = new Set([
    "che", "come", "della", "delle", "degli", "questo", "questa", "sono", "essere",
    "molto", "anche", "quando", "perché", "senza", "dopo", "prima", "tutto", "tutti",
    "with", "that", "this", "have", "from", "about", "would", "there",
  ]);
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []) {
    if (stop.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function ideaText(idea: AiIdeaContext | undefined, fallback: string): string {
  if (!idea) return fallback;
  return [idea.originalContent, idea.summary, idea.problem, idea.solution]
    .filter(Boolean)
    .join("\n");
}

function organizeNote(context: AiContext) {
  const text = context.text ?? ideaText(context.idea, "");
  const list = sentences(text);
  return {
    title: titleFrom(text || "Nota"),
    summary: list.slice(0, 2).join(" ").slice(0, 500) || text.slice(0, 200),
    category: pick(list, ["progetto", "prodotto", "cliente"]) ? "Prodotto" : "",
    tags: keywords(text).slice(0, 4),
    bulletPoints: bulletsFrom(text),
    assumptions: [
      "Titolo e sintesi derivano solo dal testo che hai scritto: nessun dato esterno è stato aggiunto.",
    ],
    questions: list.length < 2 ? ["Vuoi aggiungere il contesto in cui ti è venuta in mente?"] : [],
    citations: context.idea
      ? [{ entityType: "idea", entityId: context.idea.id, label: context.idea.title }]
      : [],
  };
}

function ideaToProject(context: AiContext) {
  const idea = context.idea;
  const text = ideaText(idea, context.text ?? "");
  const list = sentences(text);
  const problem = idea?.problem ?? pick(list, PROBLEM_HINTS);
  const solution = idea?.solution ?? pick(list, SOLUTION_HINTS);
  const audience = idea?.audience ?? pick(list, AUDIENCE_HINTS);
  const bullets = bulletsFrom(text);
  const features = bullets.slice(0, 5).map((b) => b.replace(/^(vorrei|servirebbe|potrei)\s+/i, ""));
  const mvp = features.slice(0, 3);
  const name = idea?.title ?? titleFrom(text || "Nuovo progetto");

  const sections = [
    solution && {
      key: "vision",
      label: "Visione",
      proposed: `${solution.replace(/^vorrei\s+/i, "").trim()}`,
      confidence: "medium" as const,
      rationale: "Ricavata dalla frase in cui descrivi cosa vorresti ottenere.",
    },
    problem && {
      key: "problem",
      label: "Problema",
      proposed: problem,
      confidence: "high" as const,
      rationale: "Frase del tuo testo che descrive la difficoltà.",
    },
    solution && {
      key: "solution",
      label: "Soluzione",
      proposed: solution,
      confidence: "medium" as const,
      rationale: "Frase del tuo testo che accenna a una soluzione.",
    },
    {
      key: "users",
      label: "Utenti",
      proposed: audience ?? "Non ancora dichiarato nel testo.",
      confidence: audience ? ("medium" as const) : ("low" as const),
      rationale: audience
        ? "Riferimento esplicito a un destinatario."
        : "Nessun destinatario nel testo: da confermare.",
    },
    features.length > 0 && {
      key: "features",
      label: "Funzionalità",
      proposed: features.map((f) => `• ${f}`).join("\n"),
      confidence: "low" as const,
      rationale: "Elenco derivato dai punti distinti che hai scritto.",
    },
    mvp.length > 0 && {
      key: "mvp",
      label: "MVP",
      proposed: mvp.map((f) => `• ${f}`).join("\n"),
      confidence: "low" as const,
      rationale: "I primi tre punti, come taglio minimo proposto.",
    },
    {
      key: "next",
      label: "Prossimi passi",
      proposed: "• Verificare il problema con 3 persone reali\n• Definire il taglio minimo\n• Fissare una data per la prima versione",
      confidence: "low" as const,
      rationale: "Passi standard di validazione, da adattare.",
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    proposed: string;
    confidence: "low" | "medium" | "high";
    rationale: string;
  }>;

  const nodes = [
    { key: "project", type: "project" as const, label: name, body: solution ?? "" },
    problem && { key: "problem", type: "note" as const, label: "Problema", body: problem },
    solution && { key: "solution", type: "note" as const, label: "Soluzione", body: solution },
    { key: "mvp", type: "goal" as const, label: "MVP", body: mvp.join(" · ") },
    { key: "risk", type: "risk" as const, label: "Rischio principale", body: "Ipotesi non verificata sul problema." },
  ].filter(Boolean) as Array<{ key: string; type: "project" | "note" | "goal" | "risk"; label: string; body: string }>;

  const edges = [
    problem ? { from: "problem", to: "solution", relation: "supports" as const, label: "motiva" } : null,
    { from: "solution", to: "mvp", relation: "part_of" as const, label: "confluisce in" },
    { from: "risk", to: "mvp", relation: "blocks" as const, label: "minaccia" },
    { from: "project", to: "solution", relation: "derives_from" as const, label: "" },
  ].filter(Boolean) as Array<{ from: string; to: string; relation: "supports" | "part_of" | "blocks" | "derives_from"; label: string }>;

  return {
    projectName: name,
    summary: idea?.summary ?? list.slice(0, 2).join(" ").slice(0, 400),
    sections,
    features,
    mvp,
    milestones: [
      { title: "Discovery", description: "Verificare il problema con persone reali.", weeksFromStart: 0, durationWeeks: 2, isEstimate: true as const },
      { title: "MVP", description: `Costruire: ${mvp.join(", ") || "il taglio minimo"}.`, weeksFromStart: 2, durationWeeks: 4, isEstimate: true as const },
      { title: "Validazione", description: "Metterlo in mano a chi ha il problema.", weeksFromStart: 6, durationWeeks: 2, isEstimate: true as const },
    ],
    tasks: [
      { title: "Scrivere in una frase il problema che risolvi", priority: "high" as const, milestoneTitle: "Discovery" },
      { title: "Parlare con tre persone che hanno questo problema", priority: "high" as const, milestoneTitle: "Discovery" },
      ...mvp.map((f) => ({ title: `Definire: ${f}`.slice(0, 200), priority: "medium" as const, milestoneTitle: "MVP" })),
    ].slice(0, 8),
    risks: [
      {
        title: "Il problema potrebbe non essere sentito da altri",
        likelihood: "medium" as const,
        impact: "high" as const,
        mitigation: "Tre conversazioni prima di scrivere codice.",
      },
      {
        title: "Il taglio dell'MVP può allargarsi",
        likelihood: "high" as const,
        impact: "medium" as const,
        mitigation: "Elenco chiuso di funzionalità, tutto il resto nel backlog.",
      },
    ],
    map: { nodes, edges },
    assumptions: [
      "La struttura è ricavata dal testo che hai scritto, non da fonti esterne.",
      audience ? "Il pubblico è quello che hai citato." : "Il pubblico non è dichiarato: la sezione Utenti è un segnaposto.",
      "Le durate delle milestone sono stime iniziali, non impegni.",
    ],
    questions: [
      audience ? "Chi è il primo utente che proveresti a coinvolgere?" : "Per chi è, esattamente?",
      "Cosa deve succedere perché tu consideri riuscita la prima versione?",
      problem ? "Il problema ti capita ancora oggi, o è un ricordo?" : "Qual è la difficoltà concreta che vuoi togliere?",
    ].slice(0, 3),
    citations: idea ? [{ entityType: "idea", entityId: idea.id, label: idea.title }] : [],
  };
}

function compareIdeas(context: AiContext) {
  const ideas = context.ideas ?? [];
  const criteria = ["Problema chiaro", "Fattibilità", "Interesse personale", "Differenziazione"];

  const scored = ideas.map((idea) => {
    const text = ideaText(idea, "");
    const clarity = idea.problem ? 3 : pick(sentences(text), PROBLEM_HINTS) ? 2 : 1;
    const feasibility = idea.scores?.find((s) => s.criterion === "feasibility")?.value ?? 5;
    const interest = idea.scores?.find((s) => s.criterion === "personal_interest")?.value ?? 5;
    const total = clarity * 2 + feasibility / 2 + interest / 2;
    return { idea, clarity, feasibility, interest, total, text };
  });

  const best = [...scored].sort((a, b) => b.total - a.total)[0];

  return {
    criteria,
    rows: scored.map(({ idea, clarity, feasibility, interest }) => ({
      ideaId: idea.id,
      title: idea.title,
      cells: [
        clarity >= 3 ? "Esplicito nel testo" : clarity === 2 ? "Accennato" : "Non dichiarato",
        `${feasibility}/10`,
        `${interest}/10`,
        idea.category ?? "Da valutare",
      ],
      strengths: [idea.problem ? "Problema scritto nero su bianco" : "Idea ancora aperta"],
      weaknesses: [idea.audience ? "" : "Pubblico non definito"].filter(Boolean),
    })),
    recommendation: {
      ideaId: best?.idea.id ?? "",
      reasoning: best
        ? `"${best.idea.title}" è quella con il problema più esplicito e i punteggi più alti fra quelli che hai già inserito.`
        : "Non ci sono abbastanza idee per un confronto.",
      tradeoffs: [
        "Il confronto usa solo ciò che hai già scritto e valutato: idee poco descritte risultano penalizzate.",
      ],
      uncertainties: [
        "Nessuna verifica esterna: nessun dato di mercato è stato consultato.",
      ],
    },
    assumptions: ["I punteggi mancanti sono trattati come 5/10 neutro."],
    questions: [],
    citations: ideas.map((i) => ({ entityType: "idea", entityId: i.id, label: i.title })),
  };
}

function extractTasks(context: AiContext) {
  const text = context.text ?? ideaText(context.idea, "");
  const candidates = bulletsFrom(text).filter((b) => b.length > 10);
  const verbs = ["Definire", "Verificare", "Scrivere", "Provare", "Contattare"];
  return {
    tasks: candidates.slice(0, 8).map((c, i) => ({
      title: /^[A-ZÀ-Ù]?[a-zà-ù]+are\b/.test(c) ? c.slice(0, 200) : `${verbs[i % verbs.length]}: ${c}`.slice(0, 200),
      description: "",
      priority: (i === 0 ? "high" : "medium") as "high" | "medium",
    })),
    assumptions: ["Nessuna scadenza è stata dedotta: le date le decidi tu."],
    questions: [],
    citations: context.idea
      ? [{ entityType: "idea", entityId: context.idea.id, label: context.idea.title }]
      : [],
  };
}

function nextStep(context: AiContext) {
  const summary = context.workspaceSummary;
  const project = context.project;

  if (project) {
    const blocked = project.openTasks.find((t) => t.status === "blocked");
    const overdue = project.openTasks.find((t) => t.dueDate && t.dueDate < context.today);
    const target = blocked ?? overdue ?? project.openTasks[0];
    return {
      suggestion: target ? `Sbloccare "${target.title}"` : `Scrivere il prossimo passo di ${project.name}`,
      reasoning: target
        ? blocked
          ? "È l'unica attività segnata come bloccata: finché resta ferma, il resto della milestone non si muove."
          : "È l'attività aperta più vicina alla scadenza."
        : "Il progetto non ha attività aperte: senza un passo scritto, tende a fermarsi.",
      entityType: target ? "task" : "project",
      entityId: target?.id ?? project.id,
      effortMinutes: 45,
      assumptions: ["Suggerimento basato solo su stato e scadenze delle attività, non sul contenuto del lavoro."],
      questions: [],
      citations: target
        ? [{ entityType: "task", entityId: target.id, label: target.title }]
        : [{ entityType: "project", entityId: project.id, label: project.name }],
    };
  }

  if (summary && summary.unprocessedInbox > 0) {
    return {
      suggestion: `Elaborare ${summary.unprocessedInbox} elemento/i in Inbox`,
      reasoning: "L'Inbox piena è il motivo più frequente per cui le idee smettono di muoversi.",
      entityType: "inbox_item",
      entityId: "",
      effortMinutes: 15,
      assumptions: ["Basato sul conteggio degli elementi non elaborati."],
      questions: [],
      citations: [],
    };
  }

  const stale = summary?.staleProjects[0];
  return {
    suggestion: stale ? `Riprendere "${stale.name}"` : "Catturare un pensiero",
    reasoning: stale
      ? `Nessun aggiornamento dal ${stale.lastActivityAt.slice(0, 10)}: dieci minuti bastano per decidere se continuare o metterlo in pausa consapevolmente.`
      : "Non c'è nulla in sospeso: il passo più utile è mettere giù la prossima idea prima che evapori.",
    entityType: stale ? "project" : "",
    entityId: stale?.id ?? "",
    effortMinutes: 10,
    assumptions: ["Basato su date di ultimo aggiornamento, non sul contenuto."],
    questions: [],
    citations: stale ? [{ entityType: "project", entityId: stale.id, label: stale.name }] : [],
  };
}

function projectSummary(context: AiContext) {
  const p = context.project;
  if (!p) {
    return {
      summary: "Nessun progetto nel contesto.",
      highlights: [],
      assumptions: [],
      questions: [],
      citations: [],
    };
  }
  const open = p.openTasks.length;
  const decisions = p.decisions.filter((d) => d.status === "proposed");
  return {
    summary: [
      `${p.name} è in stato "${p.status}".`,
      p.vision ? `Obiettivo dichiarato: ${p.vision}` : "Nessuna visione scritta.",
      `${open} attività aperte, ${decisions.length} decisioni ancora da chiudere.`,
      p.documentExcerpt ? `Ultimo contenuto del documento: ${p.documentExcerpt.slice(0, 180)}…` : "",
    ]
      .filter(Boolean)
      .join(" "),
    highlights: [
      ...p.openTasks.slice(0, 3).map((t) => `Aperta: ${t.title}`),
      ...decisions.slice(0, 2).map((d) => `Da decidere: ${d.title}`),
    ],
    assumptions: ["Sintesi costruita su stato, attività e decisioni registrate."],
    questions: decisions.length > 0 ? ["Vuoi chiudere una delle decisioni proposte?"] : [],
    citations: [{ entityType: "project", entityId: p.id, label: p.name }],
  };
}

function weeklySummary(context: AiContext) {
  const s = context.workspaceSummary;
  const ideas = s ? Object.values(s.ideasByStatus).reduce((a, b) => a + b, 0) : 0;
  return {
    summary: s
      ? `Questa settimana: ${ideas} idee in totale, ${s.unprocessedInbox} catture ancora da elaborare, ${s.overdueTasks.length} attività scadute e ${s.openDecisions.length} decisioni aperte. ${s.staleProjects.length > 0 ? `Fermo da un po': ${s.staleProjects.map((p) => p.name).join(", ")}.` : "Nessun progetto fermo."}`
      : "Nessun dato disponibile per questa settimana.",
    highlights: [
      ...(s?.overdueTasks.slice(0, 3).map((t) => `Scaduta: ${t.title}`) ?? []),
      ...(s?.openDecisions.slice(0, 2).map((d) => `Aperta: ${d.title}`) ?? []),
    ],
    assumptions: ["Conteggi calcolati sui dati del workspace, senza interpretazioni."],
    questions: ["Quali tre cose vuoi che siano vere fra sette giorni?"],
    citations: [],
  };
}

function missingQuestions(context: AiContext) {
  const idea = context.idea;
  const questions: Array<{ question: string; why: string }> = [];
  if (!idea?.problem) questions.push({ question: "Qual è il problema concreto, in una frase?", why: "Senza il problema non si può capire se la soluzione serve." });
  if (!idea?.audience) questions.push({ question: "Chi è la prima persona che lo userebbe?", why: "Il pubblico cambia le funzionalità minime." });
  if (!idea?.solution) questions.push({ question: "Come funzionerebbe, in pratica?", why: "Serve almeno un meccanismo, non solo un desiderio." });
  questions.push({ question: "Cosa deve essere vero perché valga la pena continuare?", why: "Definisce il criterio di stop e riduce i progetti abbandonati." });
  questions.push({ question: "Cosa esiste già che risolve la stessa cosa?", why: "Se esiste, la domanda diventa perché non basta." });
  return {
    questions: questions.slice(0, 5),
    assumptions: ["Domande generate dai campi mancanti dell'idea, non da un'analisi del mercato."],
    citations: idea ? [{ entityType: "idea", entityId: idea.id, label: idea.title }] : [],
  };
}

function similarIdeas(context: AiContext) {
  const target = context.idea;
  const others = context.ideas ?? [];
  if (!target) return { matches: [], assumptions: [], questions: [], citations: [] };

  const targetWords = new Set(keywords(ideaText(target, "")).concat(
    (ideaText(target, "").toLowerCase().match(/[\p{L}]{5,}/gu) ?? []).slice(0, 40),
  ));

  const matches = others
    .filter((o) => o.id !== target.id)
    .map((o) => {
      const words = (ideaText(o, "").toLowerCase().match(/[\p{L}]{5,}/gu) ?? []).slice(0, 40);
      const shared = words.filter((w) => targetWords.has(w));
      const similarity = words.length === 0 ? 0 : Math.min(1, shared.length / Math.max(6, words.length / 2));
      return {
        ideaId: o.id,
        similarity: Number(similarity.toFixed(2)),
        why: shared.length > 0 ? `Parole in comune: ${[...new Set(shared)].slice(0, 4).join(", ")}` : "Nessuna sovrapposizione evidente",
        duplicate: similarity > 0.75,
      };
    })
    .filter((m) => m.similarity > 0.15)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 6);

  return {
    matches,
    assumptions: ["Somiglianza calcolata su parole in comune, non su significato: è un indizio, non una prova."],
    questions: [],
    citations: [{ entityType: "idea", entityId: target.id, label: target.title }],
  };
}

const HANDLERS: Record<string, (context: AiContext) => unknown> = {
  organize_note: organizeNote,
  idea_to_project: ideaToProject,
  compare_ideas: compareIdeas,
  extract_tasks: extractTasks,
  next_step: nextStep,
  project_summary: projectSummary,
  weekly_summary: weeklySummary,
  missing_questions: missingQuestions,
  similar_ideas: similarIdeas,
};

export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly model = "heuristic-v1";

  async generate<TSchema extends z.ZodTypeAny>(
    request: AiRequest<TSchema>,
  ): Promise<AiResponse<z.infer<TSchema>>> {
    const handler = HANDLERS[request.feature];
    if (!handler) {
      throw new AiError("provider_error", `Funzione non supportata dal provider mock: ${request.feature}`);
    }

    const context = parseContext(request.user);
    const raw = handler(context);
    const parsed = request.schema.safeParse(raw);

    if (!parsed.success) {
      throw new AiError(
        "invalid_output",
        `Output mock non conforme allo schema (${request.feature}): ${parsed.error.issues[0]?.message ?? "errore"}`,
      );
    }

    return {
      data: parsed.data,
      provider: this.name,
      model: this.model,
      inputTokens: null,
      outputTokens: null,
    };
  }
}

import type { PlanTier } from "@/types/database";

export type PlanDefinition = {
  tier: PlanTier;
  name: string;
  description: string;
  priceMonthly: number | null;
  limits: {
    /** -1 means unlimited. */
    projects: number;
    ideas: number;
    aiCreditsPerMonth: number;
    storageMb: number;
    members: number;
  };
  features: string[];
};

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    description: "Per iniziare a svuotare la testa.",
    priceMonthly: 0,
    limits: {
      projects: 3,
      ideas: 100,
      aiCreditsPerMonth: 40,
      storageMb: 100,
      members: 3,
    },
    features: [
      "Inbox e idee senza limiti pratici",
      "3 progetti attivi",
      "Idea-to-Project con approvazione",
      "Esportazione Markdown e JSON",
    ],
  },
  personal: {
    tier: "personal",
    name: "Personal",
    description: "Per chi porta avanti più progetti sul serio.",
    priceMonthly: 9,
    limits: {
      projects: 25,
      ideas: -1,
      aiCreditsPerMonth: 400,
      storageMb: 2000,
      members: 1,
    },
    features: [
      "25 progetti",
      "400 crediti AI al mese",
      "Cronologia documenti estesa",
      "Collaborazione fino a 3 membri",
      "Revisione settimanale guidata",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    description: "Per chi ci lavora ogni giorno.",
    priceMonthly: 19,
    limits: {
      projects: -1,
      ideas: -1,
      aiCreditsPerMonth: 1500,
      storageMb: 10000,
      members: 10,
    },
    features: [
      "Progetti illimitati",
      "1500 crediti AI al mese",
      "Grafo globale avanzato",
      "Esportazione PDF di progetto",
      "Collaborazione fino a 10 membri",
    ],
  },
  team: {
    tier: "team",
    name: "Team",
    description: "Spazi condivisi e ruoli. In arrivo.",
    priceMonthly: null,
    limits: {
      projects: -1,
      ideas: -1,
      aiCreditsPerMonth: 5000,
      storageMb: 50000,
      members: 20,
    },
    features: ["Workspace condivisi", "Ruoli e permessi", "Commenti e mention"],
  },
};

export function planLimit(plan: PlanTier, key: keyof PlanDefinition["limits"]): number {
  return PLANS[plan].limits[key];
}

export function isWithinLimit(plan: PlanTier, key: keyof PlanDefinition["limits"], current: number): boolean {
  const limit = planLimit(plan, key);
  return limit < 0 || current < limit;
}

/** Cost in credits of each AI feature. Kept explicit so the UI can warn first. */
export const AI_FEATURE_COST: Record<string, number> = {
  organize_note: 1,
  title_and_summary: 1,
  classify: 1,
  similar_ideas: 1,
  idea_to_project: 4,
  missing_questions: 2,
  assumptions_and_risks: 2,
  mind_map: 3,
  propose_mvp: 3,
  roadmap: 3,
  extract_tasks: 2,
  compare_ideas: 3,
  project_summary: 2,
  status_update: 2,
  next_step: 1,
  weekly_summary: 2,
  contextual_chat: 1,
};

export function costOf(feature: string): number {
  return AI_FEATURE_COST[feature] ?? 1;
}

import type { Json } from "@/types/database";

/**
 * A proposal is what the AI *suggests*; nothing is written until the
 * user approves it, and approval is per section. Each section always
 * carries the current value next to the proposed one, so the diff shown
 * in the UI comes straight from the stored record.
 */

export type ProposalSectionKind =
  | "idea_field"
  | "project_field"
  | "project_section"
  | "plan"
  | "map";

export type ProposalSection = {
  key: string;
  label: string;
  /** What is stored today. Empty string means "nothing yet". */
  current: string;
  proposed: string;
  kind: ProposalSectionKind;
  confidence: "low" | "medium" | "high";
  rationale: string;
  /** Structured payload for plan/map sections, applied verbatim. */
  data?: unknown;
};

export type ProposalCitation = {
  entityType: string;
  entityId: string;
  label: string;
};

export type ProposalView = {
  id: string;
  feature: string;
  entityType: string;
  entityId: string;
  status: string;
  provider: string;
  sections: ProposalSection[];
  assumptions: string[];
  questions: string[];
  citations: ProposalCitation[];
  acceptedKeys: string[];
  createdAt: string;
};

export function parseSections(value: Json | null | undefined): ProposalSection[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(
    (item): item is ProposalSection =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as ProposalSection).key === "string" &&
      typeof (item as ProposalSection).proposed === "string",
  );
}

export function parseCitations(value: Json | null | undefined): ProposalCitation[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(
    (item): item is ProposalCitation =>
      typeof item === "object" && item !== null && "entityId" in item,
  );
}

/** True when applying the section would replace text the user wrote. */
export function isOverwrite(section: ProposalSection): boolean {
  return section.current.trim().length > 0 && section.current.trim() !== section.proposed.trim();
}

export function bulletList(items: string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

export const CONFIDENCE_LABEL: Record<ProposalSection["confidence"], string> = {
  low: "Bassa confidenza",
  medium: "Media confidenza",
  high: "Alta confidenza",
};

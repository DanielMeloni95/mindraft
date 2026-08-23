import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic short id for optimistic client-side rows. */
export function tempId(prefix = "tmp") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function truncate(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Derives a human title from a free-form capture, without calling the AI.
 * Used so that every entity has a usable label even before any AI runs.
 */
export function deriveTitle(content: string, max = 72): string {
  const firstLine =
    content
      .split(/\n+/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  const sentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
  return truncate(sentence || "Nota senza titolo", max);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "M";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralize(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Non-throwing JSON parse used for AI output and imported files. */
export function safeJsonParse<T = unknown>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

export function groupBy<T, K extends string>(
  items: readonly T[],
  key: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

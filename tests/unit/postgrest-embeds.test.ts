import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guard against a class of bug that only shows up at runtime.
 *
 * When two tables are linked by more than one foreign key, PostgREST
 * refuses an embed that does not say which one to follow:
 *
 *   "Could not embed because more than one relationship was found
 *    for 'ideas' and 'projects'"
 *
 * `ideas` ↔ `projects` are linked twice (ideas.project_id and
 * projects.source_idea_id), and so are five other pairs. This test reads
 * the real foreign keys out of the migrations, then reads every
 * .from(...).select(...) pair out of the source, and fails if an
 * ambiguous embed is missing its `!constraint_name` hint.
 */

const ROOT = path.resolve(__dirname, "../..");

type ForeignKey = { from: string; to: string; constraint: string };

function readMigrations(): string {
  const dir = path.join(ROOT, "supabase/migrations");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => fs.readFileSync(path.join(dir, file), "utf8"))
    .join("\n");
}

/** Foreign keys declared inline inside `create table public.X (...)`. */
function inlineForeignKeys(sql: string): ForeignKey[] {
  const keys: ForeignKey[] = [];
  const tableBlocks = sql.matchAll(
    /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/g,
  );

  for (const block of tableBlocks) {
    const table = block[1];
    const body = block[2];
    for (const reference of body.matchAll(
      /references\s+public\.(\w+)\s*\(/g,
    )) {
      keys.push({
        from: table,
        to: reference[1],
        // Postgres derives this name when the constraint is unnamed.
        constraint: "<derivato>",
      });
    }
  }
  return keys;
}

/** Foreign keys added later with `alter table ... add constraint`. */
function alteredForeignKeys(sql: string): ForeignKey[] {
  const keys: ForeignKey[] = [];
  for (const match of sql.matchAll(
    /alter table public\.(\w+)[\s\S]*?add constraint (\w+)\s*\n?\s*foreign key \(\w+\) references public\.(\w+)/g,
  )) {
    keys.push({ from: match[1], constraint: match[2], to: match[3] });
  }
  return keys;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

const SQL = readMigrations();

const AMBIGUOUS_PAIRS: Set<string> = (() => {
  const counts = new Map<string, number>();
  for (const key of [...inlineForeignKeys(SQL), ...alteredForeignKeys(SQL)]) {
    if (key.from === key.to) continue; // self-reference: never embedded here
    const id = pairKey(key.from, key.to);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
  );
})();

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

type Embed = { file: string; base: string; embedded: string; disambiguated: boolean };

function collectEmbeds(): Embed[] {
  const embeds: Embed[] = [];

  for (const file of sourceFiles(path.join(ROOT, "src"))) {
    const code = fs.readFileSync(file, "utf8");

    // A select can be written inline or held in a constant; both forms are
    // covered by looking at the text between .from("X") and the next .from(.
    for (const match of code.matchAll(/\.from\("(\w+)"\)([\s\S]*?)(?=\.from\("|\n\s*\}|$)/g)) {
      const base = match[1];
      const chain = match[2];

      for (const select of chain.matchAll(/\.select\(\s*(?:"([^"]*)"|(\w+))/g)) {
        const literal = select[1];
        const identifier = select[2];

        const selectText =
          literal ??
          // Resolve `const NAME = "..."` used as the select argument.
          new RegExp(`const ${identifier}\\s*=\\s*(?:"([^"]*)"|\\s*\\n\\s*"([^"]*)")`)
            .exec(code)
            ?.slice(1)
            .find(Boolean) ??
          "";

        for (const embed of selectText.matchAll(/(\w+):(\w+)(!\w+)?\(/g)) {
          embeds.push({
            file: path.relative(ROOT, file),
            base,
            embedded: embed[2],
            disambiguated: Boolean(embed[3]),
          });
        }
      }
    }
  }

  return embeds;
}

describe("PostgREST embeds", () => {
  it("finds the pairs of tables linked by more than one foreign key", () => {
    // If this ever changes, the assertion below is what protects the app.
    expect(AMBIGUOUS_PAIRS.has(pairKey("ideas", "projects"))).toBe(true);
    expect(AMBIGUOUS_PAIRS.has(pairKey("ideas", "inbox_items"))).toBe(true);
    expect(AMBIGUOUS_PAIRS.has(pairKey("canvas_edges", "canvas_nodes"))).toBe(true);
  });

  it("actually scans the source for embeds", () => {
    const embeds = collectEmbeds();
    expect(embeds.length).toBeGreaterThan(4);
    expect(embeds.some((embed) => embed.base === "ideas" && embed.embedded === "projects")).toBe(
      true,
    );
  });

  it("names the foreign key on every ambiguous embed", () => {
    const offenders = collectEmbeds()
      .filter((embed) => AMBIGUOUS_PAIRS.has(pairKey(embed.base, embed.embedded)))
      .filter((embed) => !embed.disambiguated)
      .map(
        (embed) =>
          `${embed.file}: .from("${embed.base}") embeds "${embed.embedded}" without !constraint_name`,
      );

    expect(offenders).toEqual([]);
  });
});

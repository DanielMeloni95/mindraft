import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("classificazione strumenti", () => {
  const root = process.cwd();
  const migration = readFileSync(join(root, "supabase/migrations/0020_tool_kind.sql"), "utf8");
  const expansion = readFileSync(join(root, "supabase/migrations/0021_expand_tool_kind.sql"), "utf8");
  const schema = readFileSync(join(root, "src/lib/validation/schemas.ts"), "utf8");

  it("accetta la tassonomia controllata degli strumenti", () => {
    expect(schema).toContain('z.enum(["tool", "application", "extension", "markjs", "api", "library", "service"])');
    expect(expansion).toContain("'tool','application','extension','markjs','api','library','service'");
  });

  it("classifica come Tool gli strumenti esistenti", () => {
    expect(migration).toContain("set tool_kind = 'tool'");
    expect(migration).toContain("node.data->>'variant' = 'tool'");
  });
});

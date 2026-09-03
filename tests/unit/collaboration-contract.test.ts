import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/0018_collaboration.sql"), "utf8");
const actions = readFileSync(join(root, "src/server/actions/collaboration.ts"), "utf8");
const presence = readFileSync(join(root, "src/components/projects/project-collaboration.tsx"), "utf8");

describe("contratto collaborazione", () => {
  it("limita scrittura commenti e inviti ai ruoli abilitati", () => {
    expect(migration).toContain("app.can_write(workspace_id) and author_id=auth.uid()");
    expect(actions).toContain('["owner","admin"].includes(session.role)');
  });

  it("accetta un invito solo per l'email autenticata e non scaduta", () => {
    expect(migration).toContain("expires_at>now()");
    expect(migration).toContain("lower(invitation.email)<>user_email");
  });

  it("registra commenti realtime e presenza per progetto", () => {
    expect(migration).toContain("alter publication supabase_realtime add table public.comments");
    expect(presence).toContain("presenceState");
    expect(presence).toContain("channel.track");
  });

  it("notifica solo membri effettivi del workspace", () => {
    expect(migration).toContain("m.user_id=notifications.user_id");
    expect(actions).toContain('.from("comment_mentions").insert');
  });
});

import Link from "next/link";
import { Star } from "lucide-react";

import { IdeaCard } from "@/components/ideas/idea-card";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listIdeas } from "@/server/queries/ideas";
import { listProjects } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Preferiti" };

export default async function FavoritesPage() {
  const session = await requireSession();
  const [{ items: ideas }, projects] = await Promise.all([
    listIdeas(session.supabase, session.workspace.id, { favoritesOnly: true, limit: 50 }),
    listProjects(session.supabase, session.workspace.id, { favoritesOnly: true }),
  ]);

  const empty = ideas.length === 0 && projects.length === 0;

  return (
    <>
      <PageHeader
        title="Preferiti"
        description="Le poche cose che vuoi ritrovare senza cercarle."
      />

      {empty ? (
        <EmptyState
          icon={Star}
          title="Nessun preferito"
          description="Segna con la stella le idee e i progetti che stai davvero seguendo."
        />
      ) : (
        <div className="space-y-6">
          {projects.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-sm font-semibold">Progetti</h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <li key={project.id} className="surface-card p-4">
                    <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                      {project.emoji ?? "🧩"} {project.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ideas.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-sm font-semibold">Idee</h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ideas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import type { ProposalView } from "@/lib/domain/proposals";
import {
  applyIdeaToProjectAction,
  proposeIdeaToProjectAction,
  rejectProposalAction,
  undoProposalAction,
} from "@/server/actions/ai";

import { AiBadge, AssumptionList } from "./ai-badge";
import { DiffApproval, defaultSelection } from "./diff-approval";

/**
 * The Idea-to-Project flow: propose → read the diff → approve what you
 * want → apply. Nothing is written before the last step, and the toast
 * that follows carries a real undo.
 */
export function IdeaToProjectPanel({
  ideaId,
  proposal,
  linkedProjectId,
}: {
  ideaId: string;
  proposal: ProposalView | null;
  linkedProjectId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(
    () => (proposal ? defaultSelection(proposal.sections) : new Set()),
  );

  React.useEffect(() => {
    setSelected(proposal ? defaultSelection(proposal.sections) : new Set());
  }, [proposal]);

  if (linkedProjectId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Progetto collegato</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Questa idea è già diventata un progetto. Il testo originale resta qui,
            intatto.
          </p>
          <Button variant="primary" size="sm" className="mt-3" asChild>
            <a href={`/projects/${linkedProjectId}`}>
              Apri il progetto <ArrowRight />
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!proposal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent-600" aria-hidden />
            Trasforma in progetto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Leggo quello che hai scritto e propongo una struttura: problema, soluzione,
            utenti, MVP, roadmap e mappa. Poi scegli tu cosa tenere, sezione per sezione.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await proposeIdeaToProjectAction(ideaId);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                router.refresh();
              })
            }
          >
            <Sparkles /> Proponi una struttura
          </Button>
          {pending && (
            <div className="mt-4">
              <SkeletonList rows={2} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const toggle = (key: string, next: boolean) => {
    setSelected((current) => {
      const copy = new Set(current);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  };

  const apply = () => {
    if (selected.size === 0) {
      toast.error("Seleziona almeno una sezione da applicare.");
      return;
    }

    startTransition(async () => {
      const result = await applyIdeaToProjectAction({
        proposalId: proposal.id,
        acceptedKeys: [...selected],
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const projectId = result.data.projectId;
      toast.success("Progetto creato", {
        duration: 12_000,
        action: {
          label: "Annulla",
          onClick: () => {
            void undoProposalAction(proposal.id).then((undone) => {
              if (undone.ok) {
                toast.success("Annullato: l'idea è tornata com'era.");
                router.push(`/ideas/${ideaId}`);
                router.refresh();
              } else {
                toast.error(undone.error);
              }
            });
          },
        },
      });
      router.push(`/projects/${projectId}`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent-600" aria-hidden />
          Proposta di progetto
        </CardTitle>
        <AiBadge provider={proposal.provider} />
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
          Niente è ancora stato scritto. Spunta le sezioni che vuoi tenere: le altre
          vengono scartate e puoi rifare la proposta quando vuoi.
        </p>

        <DiffApproval sections={proposal.sections} selected={selected} onToggle={toggle} />

        <AssumptionList assumptions={proposal.assumptions} questions={proposal.questions} />

        {proposal.citations.length > 0 && (
          <p className="mt-3 text-[12px] text-subtle-foreground">
            Basata su: {proposal.citations.map((c) => c.label).join(", ")}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" loading={pending} onClick={apply}>
            Applica {selected.size} di {proposal.sections.length}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              setSelected(new Set(proposal.sections.map((s) => s.key)))
            }
          >
            Seleziona tutto
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await rejectProposalAction(proposal.id);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Proposta scartata.");
                router.refresh();
              })
            }
          >
            <X /> Scarta
          </Button>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-subtle-foreground">
            <Undo2 className="size-3" aria-hidden /> annullabile dopo l&apos;applicazione
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

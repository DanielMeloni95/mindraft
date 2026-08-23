"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { captureAction } from "@/server/actions/inbox";

type Props = {
  projects: Array<{ id: string; name: string; emoji: string | null }>;
  variant?: "inline" | "dialog" | "fab";
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onCaptured?: () => void;
};

/**
 * The fastest path in the product: type, press ⌘/Ctrl+Enter, done.
 * No required fields, no modal steps, and the text stays in the box if
 * saving fails so nothing is ever lost.
 */
export function QuickCapture({
  projects,
  variant = "inline",
  placeholder = "Scrivi ciò che hai in mente…",
  autoFocus,
  className,
  onCaptured,
}: Props) {
  const router = useRouter();
  const [content, setContent] = React.useState("");
  const [projectId, setProjectId] = React.useState<string>("");
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  // Several instances live on the same page (inline, header dialog, mobile
  // FAB): unique ids keep the labels unambiguous for screen readers.
  const fieldId = React.useId();

  const submit = React.useCallback(() => {
    const value = content.trim();
    if (value.length === 0) {
      toast.error("Scrivi qualcosa prima di salvare.");
      return;
    }

    startTransition(async () => {
      const result = await captureAction({
        content: value,
        projectId: projectId || undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setContent("");
      setOpen(false);
      onCaptured?.();
      router.refresh();
      toast.success("Salvato in Inbox", {
        action: {
          label: "Apri Inbox",
          onClick: () => router.push("/inbox"),
        },
      });
    });
  }, [content, projectId, onCaptured, router]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  const form = (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={fieldId} className="sr-only">
        Cattura rapida
      </label>
      <Textarea
        id={fieldId}
        ref={textareaRef}
        value={content}
        autoFocus={autoFocus}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={variant === "inline" ? 2 : 5}
        className="resize-none bg-surface text-[15px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <>
              <label htmlFor={`${fieldId}-project`} className="text-[12px] text-muted-foreground">
                Progetto
              </label>
              <select
                id={`${fieldId}-project`}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="h-8 rounded-[var(--radius-sm)] border border-border bg-surface px-2 text-[12px] text-foreground"
              >
                <option value="">Nessuno</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.emoji ? `${project.emoji} ` : ""}
                    {project.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-subtle-foreground sm:inline">
            ⌘/Ctrl + Invio
          </span>
          <Button variant="primary" size="sm" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
            Cattura
          </Button>
        </div>
      </div>
    </div>
  );

  if (variant === "inline") return form;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "fab" ? (
          <Button
            variant="primary"
            size="icon"
            className="size-12 rounded-full shadow-raised"
            aria-label="Cattura rapida"
          >
            <Plus className="size-5" />
          </Button>
        ) : (
          <Button variant="primary" size="sm">
            <Plus /> Cattura
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cattura rapida</DialogTitle>
          <DialogDescription>
            Scrivi il pensiero così com&apos;è. Lo sistemiamo dopo, insieme.
          </DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}

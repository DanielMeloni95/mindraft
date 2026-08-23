"use client";

import * as React from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { Focus, List, Maximize2 } from "lucide-react";
import { toast } from "sonner";

import { SaveIndicator, type SaveState } from "@/components/common/save-indicator";
import { Button } from "@/components/ui/button";
import { docToPlainText, type TipTapNode } from "@/lib/domain/tiptap";
import { cn } from "@/lib/utils";
import { saveDocumentAction } from "@/server/actions/documents";

import { editorExtensions } from "./editor-extensions";
import { EditorToolbar } from "./editor-toolbar";

const AUTOSAVE_DELAY = 1_400;

type Heading = { level: number; text: string; pos: number };

/**
 * Block editor with debounced autosave and optimistic concurrency.
 *
 * The revision the editor loaded travels with every save; if the server
 * says the document moved on, we stop autosaving and tell the user
 * instead of overwriting whatever the other tab wrote.
 */
export function RichTextEditor({
  documentId,
  initialContent,
  initialRevision,
  readOnly = false,
}: {
  documentId: string;
  initialContent: JSONContent;
  initialRevision: number;
  readOnly?: boolean;
}) {
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [focusMode, setFocusMode] = React.useState(false);
  const [showOutline, setShowOutline] = React.useState(false);
  const [headings, setHeadings] = React.useState<Heading[]>([]);
  const revisionRef = React.useRef(initialRevision);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const conflictRef = React.useRef(false);

  const editor = useEditor({
    extensions: editorExtensions,
    content: initialContent,
    editable: !readOnly,
    // Required for SSR: without it the first client render can differ.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "mindraft-prose min-h-[60vh] max-w-none px-1 py-4",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Documento di progetto",
      },
    },
    onUpdate: ({ editor: instance }) => {
      refreshOutline(instance.getJSON() as TipTapNode);
      if (readOnly || conflictRef.current) return;
      scheduleSave(instance.getJSON());
    },
  });

  const refreshOutline = React.useCallback((doc: TipTapNode) => {
    const found: Heading[] = [];
    let position = 0;
    for (const node of doc.content ?? []) {
      if (node.type === "heading") {
        const text = (node.content ?? []).map((child) => child.text ?? "").join("");
        if (text.trim()) {
          found.push({ level: Number(node.attrs?.level ?? 1), text, pos: position });
        }
      }
      position += 1;
    }
    setHeadings(found);
  }, []);

  const persist = React.useCallback(
    async (json: JSONContent, label?: string) => {
      setSaveState("saving");
      const result = await saveDocumentAction({
        documentId,
        content: json,
        plainText: docToPlainText(json as TipTapNode),
        baseRevision: revisionRef.current,
        snapshotLabel: label,
      });

      if (!result.ok) {
        conflictRef.current = result.error.includes("modificato altrove");
        setSaveState("error");
        toast.error(result.error);
        return;
      }

      revisionRef.current = result.data.revision;
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
    },
    [documentId],
  );

  const scheduleSave = React.useCallback(
    (json: JSONContent) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSaveState("saving");
      timerRef.current = setTimeout(() => void persist(json), AUTOSAVE_DELAY);
    },
    [persist],
  );

  React.useEffect(() => {
    if (editor) refreshOutline(editor.getJSON() as TipTapNode);
  }, [editor, refreshOutline]);

  // Flush pending work when the tab goes away.
  React.useEffect(() => {
    const flush = () => {
      if (timerRef.current && editor) {
        clearTimeout(timerRef.current);
        void persist(editor.getJSON());
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, persist]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        if (editor) void persist(editor.getJSON(), "Salvataggio manuale");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editor, persist]);

  if (!editor) {
    return (
      <div className="surface-card p-6" role="status" aria-live="polite">
        <span className="text-[13px] text-muted-foreground">Apertura dell&apos;editor…</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "surface-card overflow-hidden",
        focusMode && "fixed inset-0 z-50 rounded-none border-0 overflow-y-auto",
      )}
    >
      {!readOnly && <EditorToolbar editor={editor} />}

      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowOutline((value) => !value)}
          aria-expanded={showOutline}
        >
          <List /> Indice
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setFocusMode((value) => !value)}>
          {focusMode ? <Maximize2 /> : <Focus />}
          {focusMode ? "Esci dal focus" : "Modalità focus"}
        </Button>
        <span className="ml-auto flex items-center gap-3">
          <span className="text-[11px] tabular-nums text-subtle-foreground">
            {editor.storage.characterCount.words()} parole
          </span>
          <SaveIndicator state={saveState} />
        </span>
      </div>

      <div className={cn("flex gap-4 px-4", focusMode && "mx-auto max-w-3xl")}>
        {showOutline && (
          <nav className="hidden w-48 shrink-0 py-4 md:block" aria-label="Indice del documento">
            {headings.length === 0 ? (
              <p className="text-[12px] text-subtle-foreground">
                Nessun titolo: usa i livelli per creare l&apos;indice.
              </p>
            ) : (
              <ul className="space-y-1">
                {headings.map((heading, index) => (
                  <li key={index} style={{ paddingLeft: `${(heading.level - 1) * 10}px` }}>
                    <button
                      type="button"
                      onClick={() => {
                        editor.commands.focus();
                        const element = document.querySelectorAll(
                          ".mindraft-prose h1, .mindraft-prose h2, .mindraft-prose h3",
                        )[index];
                        element?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="w-full truncate text-left text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      {heading.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        )}

        <div className="min-w-0 flex-1">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

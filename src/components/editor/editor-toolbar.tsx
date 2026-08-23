"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const button = (
    key: string,
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    active = false,
  ) => (
    <Hint key={key} label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "rounded-[var(--radius-sm)] p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground",
          active && "bg-surface-muted text-foreground",
        )}
      >
        {icon}
      </button>
    </Hint>
  );

  return (
    <div
      className="sticky top-14 z-20 -mx-1 flex flex-wrap items-center gap-0.5 border-b border-border bg-surface/95 px-1 py-1.5 backdrop-blur"
      role="toolbar"
      aria-label="Formattazione"
    >
      {button("bold", "Grassetto", <Bold className="size-4" />, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
      {button("italic", "Corsivo", <Italic className="size-4" />, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
      {button("underline", "Sottolineato", <UnderlineIcon className="size-4" />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
      {button("strike", "Barrato", <Strikethrough className="size-4" />, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      {button("h1", "Titolo 1", <Heading1 className="size-4" />, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }))}
      {button("h2", "Titolo 2", <Heading2 className="size-4" />, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
      {button("h3", "Titolo 3", <Heading3 className="size-4" />, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      {button("ul", "Elenco puntato", <List className="size-4" />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {button("ol", "Elenco numerato", <ListOrdered className="size-4" />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
      {button("task", "Checklist", <ListChecks className="size-4" />, () => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"))}
      {button("quote", "Citazione", <Quote className="size-4" />, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
      {button("code", "Blocco di codice", <Code className="size-4" />, () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}
      {button("hr", "Divisore", <Minus className="size-4" />, () => editor.chain().focus().setHorizontalRule().run())}

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      {button("link", "Link", <LinkIcon className="size-4" />, () => {
        const previous = editor.getAttributes("link").href as string | undefined;
        const value = window.prompt("Indirizzo del link", previous ?? "https://");
        if (value === null) return;
        if (value === "") {
          editor.chain().focus().unsetLink().run();
          return;
        }
        if (!isSafeUrl(value)) {
          window.alert("Sono ammessi solo indirizzi http, https o mailto.");
          return;
        }
        editor.chain().focus().setLink({ href: value }).run();
      }, editor.isActive("link"))}

      {button("image", "Immagine da URL", <ImageIcon className="size-4" />, () => {
        const value = window.prompt("Indirizzo dell'immagine", "https://");
        if (!value) return;
        if (!isSafeUrl(value)) {
          window.alert("Indirizzo non valido.");
          return;
        }
        editor.chain().focus().setImage({ src: value }).run();
      })}

      {button("table", "Tabella", <TableIcon className="size-4" />, () =>
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      )}

      <span className="ml-auto flex items-center gap-0.5">
        {button("undo", "Annulla", <Undo2 className="size-4" />, () => editor.chain().focus().undo().run())}
        {button("redo", "Ripeti", <Redo2 className="size-4" />, () => editor.chain().focus().redo().run())}
      </span>
    </div>
  );
}

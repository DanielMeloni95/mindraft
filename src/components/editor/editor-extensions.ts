import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

/**
 * The block set the product promises: text, headings, lists, checklists,
 * quotes, code, tables, images, dividers. Links are sanitised — only
 * http(s) and mailto survive, so pasted content cannot smuggle in a
 * javascript: URL.
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: { HTMLAttributes: { class: "font-mono" } },
    dropcursor: { color: "var(--primary)", width: 2 },
  }),
  Underline,
  Link.configure({
    openOnClick: false,
    autolink: true,
    protocols: ["http", "https", "mailto"],
    HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
  }),
  Placeholder.configure({
    placeholder: ({ node }) =>
      node.type.name === "heading"
        ? "Titolo della sezione"
        : "Scrivi, oppure premi / per un blocco…",
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Image.configure({ allowBase64: false, inline: false }),
  CharacterCount.configure({ limit: 200_000 }),
];

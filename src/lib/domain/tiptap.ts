import type { Json } from "@/types/database";

/**
 * Minimal, dependency-free helpers for TipTap's ProseMirror JSON.
 * They run on the server too (search indexing, export), so they cannot
 * rely on the editor instance.
 */

export type TipTapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: TipTapNode[];
};

export const EMPTY_DOC: TipTapNode = { type: "doc", content: [] };

export function isTipTapDoc(value: unknown): value is TipTapNode {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as TipTapNode).type === "doc"
  );
}

export function asDoc(value: Json | null | undefined): TipTapNode {
  return isTipTapDoc(value) ? value : EMPTY_DOC;
}

/** Flattened text, used for full-text search and previews. */
export function docToPlainText(node: Json | TipTapNode | null | undefined): string {
  const doc = isTipTapDoc(node) ? node : asDoc(node as Json);
  const parts: string[] = [];

  const walk = (n: TipTapNode) => {
    if (typeof n.text === "string") parts.push(n.text);
    if (n.type === "hardBreak") parts.push("\n");
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
      if (["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(n.type ?? "")) {
        parts.push("\n");
      }
    }
  };

  walk(doc);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

/** Export helper: ProseMirror JSON → Markdown. Covers the blocks the editor offers. */
export function docToMarkdown(node: Json | TipTapNode | null | undefined): string {
  const doc = isTipTapDoc(node) ? node : asDoc(node as Json);
  const lines: string[] = [];

  const inline = (nodes: TipTapNode[] | undefined): string =>
    (nodes ?? [])
      .map((n) => {
        if (n.type === "hardBreak") return "  \n";
        let text = n.text ?? "";
        for (const mark of n.marks ?? []) {
          if (mark.type === "bold") text = `**${text}**`;
          else if (mark.type === "italic") text = `*${text}*`;
          else if (mark.type === "code") text = `\`${text}\``;
          else if (mark.type === "strike") text = `~~${text}~~`;
          else if (mark.type === "underline") text = `<u>${text}</u>`;
          else if (mark.type === "link") {
            const href = (mark.attrs?.href as string) ?? "";
            text = `[${text}](${href})`;
          }
        }
        return text;
      })
      .join("");

  const block = (n: TipTapNode, depth = 0): void => {
    const pad = "  ".repeat(depth);
    switch (n.type) {
      case "heading": {
        const level = Number(n.attrs?.level ?? 1);
        lines.push(`${"#".repeat(Math.min(6, Math.max(1, level)))} ${inline(n.content)}`, "");
        break;
      }
      case "paragraph":
        lines.push(`${pad}${inline(n.content)}`, "");
        break;
      case "bulletList":
        (n.content ?? []).forEach((item) => {
          lines.push(`${pad}- ${inline(item.content?.[0]?.content)}`);
          (item.content ?? []).slice(1).forEach((child) => block(child, depth + 1));
        });
        lines.push("");
        break;
      case "orderedList":
        (n.content ?? []).forEach((item, index) => {
          lines.push(`${pad}${index + 1}. ${inline(item.content?.[0]?.content)}`);
          (item.content ?? []).slice(1).forEach((child) => block(child, depth + 1));
        });
        lines.push("");
        break;
      case "taskList":
        (n.content ?? []).forEach((item) => {
          const checked = item.attrs?.checked ? "x" : " ";
          lines.push(`${pad}- [${checked}] ${inline(item.content?.[0]?.content)}`);
        });
        lines.push("");
        break;
      case "blockquote":
        (n.content ?? []).forEach((child) => {
          lines.push(`> ${inline(child.content)}`);
        });
        lines.push("");
        break;
      case "codeBlock":
        lines.push("```" + String(n.attrs?.language ?? ""), inline(n.content), "```", "");
        break;
      case "horizontalRule":
        lines.push("---", "");
        break;
      case "image":
        lines.push(`![${String(n.attrs?.alt ?? "")}](${String(n.attrs?.src ?? "")})`, "");
        break;
      case "table":
        (n.content ?? []).forEach((row, rowIndex) => {
          const cells = (row.content ?? []).map((cell) =>
            inline(cell.content?.[0]?.content).replace(/\|/g, "\\|"),
          );
          lines.push(`| ${cells.join(" | ")} |`);
          if (rowIndex === 0) {
            lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
          }
        });
        lines.push("");
        break;
      default:
        if (Array.isArray(n.content)) n.content.forEach((child) => block(child, depth));
    }
  };

  (doc.content ?? []).forEach((n) => block(n));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Import helper: plain text / light Markdown → ProseMirror JSON. */
export function textToDoc(text: string): TipTapNode {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim().length > 0);
  if (blocks.length === 0) return EMPTY_DOC;

  const content: TipTapNode[] = [];

  for (const raw of blocks) {
    const trimmed = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: [{ type: "text", text: heading[2] }],
      });
      continue;
    }

    const lines = trimmed.split("\n");
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      content.push({
        type: "bulletList",
        content: lines.map((l) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: l.replace(/^\s*[-*]\s+/, "") }],
            },
          ],
        })),
      });
      continue;
    }

    content.push({
      type: "paragraph",
      content: [{ type: "text", text: trimmed.replace(/\n/g, " ") }],
    });
  }

  return { type: "doc", content };
}

/** Builds the starting document of a project from its approved sections. */
export function sectionsToDoc(
  sections: Array<{ title: string; content: string }>,
): TipTapNode {
  const content: TipTapNode[] = [];
  for (const section of sections) {
    content.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: section.title }],
    });
    const body = section.content.trim();
    const inner = body.length > 0 ? textToDoc(body).content ?? [] : [{ type: "paragraph" }];
    content.push(...inner);
  }
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

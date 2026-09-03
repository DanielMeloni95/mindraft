type PdfLine = { text: string; size: number; bold: boolean; gapBefore?: number };

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 54;
const TOP = 64;
const BOTTOM = 54;

function pdfText(value: string) {
  return value
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\xFF]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function plainMarkdown(line: string) {
  return line
    .replace(/^>\s?/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function wrap(text: string, size: number, indent = "") {
  const usable = PAGE_WIDTH - MARGIN_X * 2;
  const maxChars = Math.max(24, Math.floor(usable / (size * 0.52)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = indent;
  for (const word of words) {
    if (current.length > indent.length && `${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = `${indent}${word}`;
    } else {
      current += `${current.length > indent.length ? " " : ""}${word}`;
    }
  }
  if (current.trim()) lines.push(current);
  return lines.length ? lines : [""];
}

function markdownLines(markdown: string): PdfLine[] {
  const result: PdfLine[] = [];
  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line || /^---+$/.test(line) || /^\|?\s*:?-+:?/.test(line)) continue;
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const size = level === 1 ? 20 : level === 2 ? 15 : level === 3 ? 12.5 : 11;
      for (const [index, wrapped] of wrap(plainMarkdown(heading[2]), size).entries()) {
        result.push({ text: wrapped, size, bold: true, gapBefore: index ? 0 : level === 1 ? 14 : 9 });
      }
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      const cells = line.split("|").map((cell) => plainMarkdown(cell)).filter(Boolean);
      for (const wrapped of wrap(cells.join("  |  "), 9)) result.push({ text: wrapped, size: 9, bold: false });
      continue;
    }
    const bullet = /^[-*+]\s+(.+)$/.exec(line);
    const numbered = /^(\d+)[.)]\s+(.+)$/.exec(line);
    const prefix = bullet ? "-  " : numbered ? `${numbered[1]}.  ` : "";
    const body = plainMarkdown(bullet?.[1] ?? numbered?.[2] ?? line);
    for (const wrapped of wrap(body, 10.5, prefix)) {
      result.push({ text: wrapped, size: 10.5, bold: false, gapBefore: 0 });
    }
  }
  return result;
}

function pageStream(lines: PdfLine[], pageNumber: number, totalPages: number) {
  let y = PAGE_HEIGHT - TOP;
  const commands = ["BT", "/F2 8 Tf", `0.35 0.42 0.55 rg`, `${MARGIN_X} ${PAGE_HEIGHT - 34} Td`, `(MINDRAFT / DOCUMENTO AGENTICO) Tj`, "ET"];
  for (const line of lines) {
    y -= line.gapBefore ?? 0;
    commands.push("BT", `/${line.bold ? "F2" : "F1"} ${line.size} Tf`, line.bold ? "0.10 0.25 0.55 rg" : "0.08 0.11 0.18 rg", `${MARGIN_X} ${y} Td`, `(${pdfText(line.text)}) Tj`, "ET");
    y -= line.size * 1.42;
  }
  commands.push("BT", "/F1 8 Tf", "0.40 0.45 0.55 rg", `${PAGE_WIDTH / 2 - 14} 28 Td`, `(Pagina ${pageNumber} / ${totalPages}) Tj`, "ET");
  return commands.join("\n");
}

export function markdownToPdf(markdown: string): Uint8Array {
  const lines = markdownLines(markdown);
  const pages: PdfLine[][] = [[]];
  let used = 0;
  const capacity = PAGE_HEIGHT - TOP - BOTTOM;
  for (const line of lines) {
    const height = (line.gapBefore ?? 0) + line.size * 1.42;
    if (used + height > capacity && pages.at(-1)!.length) {
      pages.push([]);
      used = 0;
    }
    pages.at(-1)!.push(line);
    used += height;
  }

  const objects: string[] = [];
  const add = (body: string) => (objects.push(body), objects.length);
  const catalogId = add("");
  const pagesId = add("");
  const regularFontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldFontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  pages.forEach((page, index) => {
    const stream = pageStream(page, index + 1, pages.length);
    const streamLength = Buffer.byteLength(stream, "latin1");
    const contentId = add(`<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets = [0];
  let offset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`, "latin1");
    chunks.push(chunk);
    offset += chunk.length;
  });
  const xrefOffset = offset;
  const xref = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n", ...offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n \n`)].join("");
  chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`, "latin1"));
  return Buffer.concat(chunks);
}

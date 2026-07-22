import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import {
  DISCLAIMER_SHORT,
  REVIEW_BEFORE_USE_TITLE,
} from "@/lib/legal/disclaimers";

/**
 * PDF/DOCX export for generated documents (Part 4.1). Every export carries
 * the draft notice and a lawyer review/signature block — the "review before
 * use" framing travels with the file, not just the screen.
 */

const DRAFT_NOTICE = `DRAFT — ${DISCLAIMER_SHORT} ${REVIEW_BEFORE_USE_TITLE} by a licensed lawyer in the relevant jurisdiction.`;

const SIGNATURE_LINES = [
  "Reviewed and approved by:",
  "Signature: ________________________________",
  "Name / Bar number: ________________________",
  "Date: ____________________________________",
];

// ---- Light markdown model ----------------------------------------------------

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "numbered"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "rule" }
  | { kind: "blank" };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      blocks.push({ kind: "blank" });
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      blocks.push({ kind: "rule" });
    } else if (t.startsWith("### ")) {
      blocks.push({ kind: "heading", level: 3, text: t.slice(4) });
    } else if (t.startsWith("## ")) {
      blocks.push({ kind: "heading", level: 2, text: t.slice(3) });
    } else if (t.startsWith("# ")) {
      blocks.push({ kind: "heading", level: 1, text: t.slice(2) });
    } else if (/^[-*•]\s+/.test(t)) {
      blocks.push({ kind: "bullet", text: t.replace(/^[-*•]\s+/, "") });
    } else if (/^\d+[.)]\s+/.test(t)) {
      blocks.push({ kind: "numbered", text: t });
    } else {
      blocks.push({ kind: "paragraph", text: t });
    }
  }
  return blocks;
}

/** Inline runs: **bold** honored, other markers stripped. */
type Run = { text: string; bold: boolean };
function parseRuns(text: string): Run[] {
  const runs: Run[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      runs.push({ text: part.slice(2, -2), bold: true });
    } else {
      runs.push({ text: part.replace(/[_*`]/g, ""), bold: false });
    }
  }
  return runs.length > 0 ? runs : [{ text: "", bold: false }];
}

function plainText(text: string): string {
  return parseRuns(text)
    .map((r) => r.text)
    .join("");
}

// ---- PDF ---------------------------------------------------------------------

const PAGE = { width: 612, height: 792 }; // US Letter
const MARGIN = 72;
const BODY_SIZE = 11.5;
const LEADING = 17;

export async function buildPdf(
  title: string,
  bodyMarkdown: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer("Justice");
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const maxWidth = PAGE.width - MARGIN * 2;

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 28) newPage();
  };

  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [""];
  };

  const drawLines = (
    text: string,
    font: PDFFont,
    size: number,
    opts: { indent?: number; leading?: number } = {},
  ) => {
    const indent = opts.indent ?? 0;
    const leading = opts.leading ?? LEADING;
    for (const line of wrap(text, font, size, maxWidth - indent)) {
      ensure(leading);
      page.drawText(line, {
        x: MARGIN + indent,
        y,
        size,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= leading;
    }
  };

  // Title
  drawLines(plainText(title), serifBold, 17, { leading: 24 });
  y -= 10;

  for (const block of parseBlocks(bodyMarkdown)) {
    switch (block.kind) {
      case "blank":
        y -= LEADING * 0.55;
        break;
      case "rule":
        ensure(LEADING);
        page.drawLine({
          start: { x: MARGIN, y: y + 4 },
          end: { x: PAGE.width - MARGIN, y: y + 4 },
          thickness: 0.7,
          color: rgb(0.65, 0.62, 0.55),
        });
        y -= LEADING * 0.8;
        break;
      case "heading": {
        y -= 6;
        const size = block.level === 1 ? 14.5 : block.level === 2 ? 13 : 12;
        drawLines(plainText(block.text), serifBold, size, {
          leading: LEADING + 3,
        });
        y -= 2;
        break;
      }
      case "bullet":
        ensure(LEADING);
        page.drawText("•", {
          x: MARGIN + 6,
          y,
          size: BODY_SIZE,
          font: serif,
          color: rgb(0.1, 0.1, 0.1),
        });
        drawLines(plainText(block.text), serif, BODY_SIZE, { indent: 20 });
        break;
      case "numbered":
        drawLines(plainText(block.text), serif, BODY_SIZE, { indent: 6 });
        break;
      case "paragraph":
        drawLines(plainText(block.text), serif, BODY_SIZE);
        break;
    }
  }

  // Signature / review block (Part 4.1)
  ensure(LEADING * (SIGNATURE_LINES.length + 3));
  y -= LEADING * 1.5;
  page.drawLine({
    start: { x: MARGIN, y: y + 10 },
    end: { x: PAGE.width - MARGIN, y: y + 10 },
    thickness: 0.7,
    color: rgb(0.65, 0.62, 0.55),
  });
  for (const [i, line] of SIGNATURE_LINES.entries()) {
    drawLines(line, i === 0 ? serifBold : serif, 10.5, {
      leading: i === 0 ? LEADING : LEADING + 4,
    });
  }

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(DRAFT_NOTICE, {
      x: MARGIN,
      y: MARGIN - 34,
      size: 7.5,
      font: sans,
      color: rgb(0.45, 0.42, 0.38),
      maxWidth: PAGE.width - MARGIN * 2 - 40,
      lineHeight: 9,
    });
    const label = `${i + 1} / ${pages.length}`;
    p.drawText(label, {
      x: PAGE.width - MARGIN - sans.widthOfTextAtSize(label, 8),
      y: MARGIN - 34,
      size: 8,
      font: sans,
      color: rgb(0.45, 0.42, 0.38),
    });
  });

  return doc.save();
}

// ---- DOCX --------------------------------------------------------------------

export async function buildDocx(
  title: string,
  bodyMarkdown: string,
): Promise<Uint8Array> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: plainText(title) })],
      spacing: { after: 280 },
    }),
  ];

  for (const block of parseBlocks(bodyMarkdown)) {
    switch (block.kind) {
      case "blank":
        children.push(new Paragraph({ spacing: { after: 60 } }));
        break;
      case "rule":
        children.push(
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "A69B84" },
            },
            spacing: { after: 160 },
          }),
        );
        break;
      case "heading":
        children.push(
          new Paragraph({
            heading:
              block.level === 1
                ? HeadingLevel.HEADING_1
                : block.level === 2
                  ? HeadingLevel.HEADING_2
                  : HeadingLevel.HEADING_3,
            children: [new TextRun({ text: plainText(block.text) })],
            spacing: { before: 200, after: 120 },
          }),
        );
        break;
      case "bullet":
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: toRuns(block.text),
            spacing: { after: 80 },
          }),
        );
        break;
      case "numbered":
      case "paragraph":
        children.push(
          new Paragraph({
            children: toRuns(block.text),
            spacing: { after: 120, line: 300 },
          }),
        );
        break;
    }
  }

  // Signature / review block
  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "A69B84" } },
      spacing: { before: 500, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: SIGNATURE_LINES[0], bold: true })],
      spacing: { after: 200 },
    }),
    ...SIGNATURE_LINES.slice(1).map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line })],
          spacing: { after: 240 },
        }),
    ),
  );

  const doc = new Document({
    creator: "Justice",
    title: plainText(title),
    styles: {
      default: {
        document: { run: { font: "Georgia", size: 23 } }, // 11.5pt
      },
    },
    sections: [
      {
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: DRAFT_NOTICE, size: 15, color: "6B6B6B" }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES],
                    size: 15,
                    color: "6B6B6B",
                  }),
                ],
              }),
            ],
          }),
        },
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

function toRuns(text: string): TextRun[] {
  return parseRuns(text).map(
    (r) => new TextRun({ text: r.text, bold: r.bold }),
  );
}

/** Safe download filename from a title. */
export function exportFilename(title: string, ext: "pdf" | "docx"): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document";
  return `${slug}.${ext}`;
}

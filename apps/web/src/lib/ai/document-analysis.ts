import "server-only";
import {
  completeStructured,
  type AiAttachment,
} from "./provider";
import type { DocumentAnalysis } from "@/lib/documents/analysis-types";
import {
  formatJurisdiction,
  hasJurisdiction,
  type Jurisdiction,
} from "@/lib/legal/jurisdiction";

/**
 * Document Intelligence extraction (Part 4.1 / Part 8). One structured
 * multimodal call: the model reads the PDF/image and returns the Part 8
 * analysis shape plus verbatim clause segments for highlight-linking.
 */

/** Strict JSON schema (OpenAI structured outputs: every property required,
 * additionalProperties:false; optionality is expressed with null types). */
const ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "document_type",
    "jurisdiction_relevant",
    "jurisdiction_note",
    "detected_language",
    "plain_language_summary",
    "truncated",
    "segments",
    "key_obligations",
    "risky_or_unusual_clauses",
    "important_dates",
  ],
  properties: {
    document_type: {
      type: "string",
      description:
        'Specific type in plain words, e.g. "residential lease agreement".',
    },
    jurisdiction_relevant: {
      type: "boolean",
      description:
        "Whether jurisdiction-specific rules materially affect this document.",
    },
    jurisdiction_note: {
      type: ["string", "null"],
      description:
        "One-sentence caveat when the user's jurisdiction changes or clouds the reading; null when none is needed.",
    },
    detected_language: { type: "string" },
    plain_language_summary: {
      type: "string",
      description:
        "3–6 sentences a stressed non-lawyer can absorb: what this document is, what it does to them, and the single most important thing to know.",
    },
    truncated: {
      type: "boolean",
      description:
        "True only if the document was too long to reconstruct every clause in segments.",
    },
    segments: {
      type: "array",
      description:
        "The document's full text, in order, split at clause/paragraph level. Verbatim — no paraphrase, no correction.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "heading", "text"],
        properties: {
          id: { type: "integer" },
          heading: { type: ["string", "null"] },
          text: { type: "string" },
        },
      },
    },
    key_obligations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["party", "obligation", "deadline_if_any", "segment_ids"],
        properties: {
          party: { type: "string" },
          obligation: { type: "string" },
          deadline_if_any: { type: ["string", "null"] },
          segment_ids: { type: "array", items: { type: "integer" } },
        },
      },
    },
    risky_or_unusual_clauses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "clause_excerpt_summary",
          "why_flagged",
          "section_reference",
          "severity",
          "segment_ids",
        ],
        properties: {
          clause_excerpt_summary: { type: "string" },
          why_flagged: { type: "string" },
          section_reference: { type: ["string", "null"] },
          severity: { type: "string", enum: ["caution", "high"] },
          segment_ids: { type: "array", items: { type: "integer" } },
        },
      },
    },
    important_dates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "date_text", "iso_date", "segment_ids"],
        properties: {
          label: { type: "string" },
          date_text: { type: "string" },
          iso_date: { type: ["string", "null"] },
          segment_ids: { type: "array", items: { type: "integer" } },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are Justice's document analyst. You read legal documents (contracts, notices, court papers, agreements — typed or scanned) and explain them in plain language for people who are not lawyers.

Non-negotiable framing: you provide legal information, not legal advice; you never make final legal determinations. Be honest about risk without being alarmist.

Extraction discipline:
- Reconstruct the document's text as ordered clause-level segments, VERBATIM. Do not paraphrase, summarize, or fix errors inside segment text. Preserve the original language of the document.
- If parts are illegible (poor scan), put "[illegible]" where text cannot be read — never invent content.
- Segment ids start at 0 and increase in document order. Every obligation, risky clause, and date must reference the segment id(s) it comes from.
- Only report what the document actually says. If the document is not a legal document, say so in document_type and analyze what is genuinely useful.
- Write obligations/flags/summary in clear plain language (translate to the user's language if theirs differs from the document's).
- Flag as risky/unusual: one-sided terms, waivers of rights, automatic renewals, hidden fees, unusually short response windows, penalties, anything a careful lawyer would circle. severity "high" only for genuinely dangerous terms.`;

export type AnalyzeDocumentInput = {
  attachment: AiAttachment;
  jurisdiction: Jurisdiction | null;
  preferredLanguage?: string | null;
};

export async function analyzeDocument(
  input: AnalyzeDocumentInput,
): Promise<DocumentAnalysis> {
  const jurisdictionLine = hasJurisdiction(input.jurisdiction)
    ? `The reader's jurisdiction is ${formatJurisdiction(input.jurisdiction)}. Read the document against it and set jurisdiction_note when local rules matter or are uncertain.`
    : `The reader has not set a jurisdiction. Note in jurisdiction_note when the answer depends on where they live.`;

  const languageLine =
    input.preferredLanguage && input.preferredLanguage !== "en"
      ? `Write the summary, obligations, and flags in the reader's language (code "${input.preferredLanguage}"); segments stay verbatim in the document's language.`
      : "";

  const analysis = await completeStructured<DocumentAnalysis>({
    system: SYSTEM_PROMPT,
    prompt: [
      "Analyze the attached document per your instructions.",
      jurisdictionLine,
      languageLine,
    ]
      .filter(Boolean)
      .join("\n"),
    attachment: input.attachment,
    schemaName: "justice_document_analysis",
    schema: ANALYSIS_SCHEMA,
  });

  return sanitizeAnalysis(analysis);
}

/** Defense-in-depth: clamp anchor references so a stray id from the model
 * can never break the linking UI. */
function sanitizeAnalysis(a: DocumentAnalysis): DocumentAnalysis {
  const valid = new Set(a.segments.map((s) => s.id));
  const clamp = (ids: number[]) => ids.filter((id) => valid.has(id));
  return {
    ...a,
    key_obligations: a.key_obligations.map((o) => ({
      ...o,
      segment_ids: clamp(o.segment_ids),
    })),
    risky_or_unusual_clauses: a.risky_or_unusual_clauses.map((r) => ({
      ...r,
      segment_ids: clamp(r.segment_ids),
    })),
    important_dates: a.important_dates.map((d) => ({
      ...d,
      segment_ids: clamp(d.segment_ids),
    })),
  };
}

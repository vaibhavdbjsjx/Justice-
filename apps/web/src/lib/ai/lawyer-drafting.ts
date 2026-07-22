import "server-only";
import { completeStructured } from "./provider";
import { GENERATED_DOCUMENT_SCHEMA } from "./document-generation";
import type { GeneratedDocument } from "@/lib/generation/types";
import type { LawyerDocType } from "@/lib/drafting/doc-types";
import type { RedlineResult } from "@/lib/drafting/types";
import {
  formatJurisdiction,
  hasJurisdiction,
  type Jurisdiction,
} from "@/lib/legal/jurisdiction";

/**
 * Lawyer drafting assistant calls (Phase 7, Part 4.3): free-form drafting and
 * redlining for legal professionals. Two disciplines carry the value here —
 * nothing invented (facts → [PLACEHOLDERS], authority → "[verify]") and every
 * judgment call surfaced, so the lawyer stays in control (Part 8).
 */

const LAWYER_DRAFT_SYSTEM = `You are Justice's drafting assistant for legal professionals. You produce rigorous first drafts for a licensed lawyer who will review, edit, and take responsibility for the final instrument.

Framing: drafting assistance for a professional — the lawyer stays in control. The product stamps every export as a draft for review; do NOT add disclaimer text to the document body.

Drafting discipline:
- NEVER invent facts, parties, dates, amounts, or terms. Anything needed but not provided goes in as a [BRACKETED PLACEHOLDER] and is listed verbatim in placeholders.
- NEVER fabricate authority. Cite a statute, case, or rule only when you are confident it exists and supports the point, and mark it "[verify]" in the body; otherwise name the doctrine generally and flag it in review_flags.
- Technical precision over plain language — the reader is a lawyer. Consistent defined terms, one term per concept, tight operative language.
- Every judgment call goes in review_flags, specifically: a chosen standard or threshold, an allocation of risk, an assumed procedural posture, a jurisdiction-dependent formality or notice period. Honest and concrete, not boilerplate.
- Jurisdiction-aware: shape the draft to the given jurisdiction's conventions; where a rule varies by place and you are not certain, use a placeholder plus a review_flags entry rather than guessing. jurisdiction_caveat carries one sentence when local rules could change the instrument's form, deadlines, or enforceability; null otherwise.
- Structure per the type guidance in the request, in clean markdown.`;

export type LawyerDraftInput = {
  docType: LawyerDocType;
  /** The lawyer's free-form drafting instructions. */
  instructions: string;
  jurisdiction: Jurisdiction | null;
  licensedJurisdictions?: string[];
};

export async function draftForLawyer(
  input: LawyerDraftInput,
): Promise<GeneratedDocument> {
  const jurisdictionLine = hasJurisdiction(input.jurisdiction)
    ? `Jurisdiction: ${formatJurisdiction(input.jurisdiction)} (the instructions may name another — follow the instructions).`
    : "Jurisdiction: not set — prefer placeholders + review_flags over guessed local rules.";

  const licensedLine =
    input.licensedJurisdictions && input.licensedJurisdictions.length > 0
      ? `The lawyer is licensed in: ${input.licensedJurisdictions.join("; ")}.`
      : null;

  const prompt = [
    `Draft: ${input.docType.name.toLowerCase()}.`,
    `Structure guidance: ${input.docType.guidance}`,
    jurisdictionLine,
    licensedLine,
    `The lawyer's instructions:\n"""\n${input.instructions}\n"""`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return completeStructured<GeneratedDocument>({
    system: LAWYER_DRAFT_SYSTEM,
    prompt,
    schemaName: "justice_lawyer_draft",
    schema: GENERATED_DOCUMENT_SCHEMA,
    maxTokens: 8_000,
  });
}

const REDLINE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "summary",
    "revised_markdown",
    "changes",
    "review_flags",
    "jurisdiction_caveat",
  ],
  properties: {
    title: {
      type: "string",
      description:
        'Short label for the revised draft, e.g. "Services agreement — revised indemnification".',
    },
    summary: {
      type: "string",
      description:
        "Two–three sentences a lawyer reads first: overall approach and the riskiest calls made.",
    },
    revised_markdown: {
      type: "string",
      description:
        "The COMPLETE revised document in markdown. Retained text appears in full — never elided or summarized.",
    },
    changes: {
      type: "array",
      description: "One entry per meaningful edit, in document order.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "heading",
          "kind",
          "original_excerpt",
          "revised_excerpt",
          "rationale",
        ],
        properties: {
          heading: {
            type: "string",
            description:
              'Short label, e.g. "Liability cap tied to fees paid".',
          },
          kind: {
            type: "string",
            enum: ["substantive", "risk", "clarity"],
            description:
              "substantive = rights/obligations shift; risk = liability, indemnity, remedies, compliance exposure; clarity = wording, structure, consistency.",
          },
          original_excerpt: {
            type: ["string", "null"],
            description:
              "Shortest quote from the original showing what changed; null for pure insertions.",
          },
          revised_excerpt: {
            type: ["string", "null"],
            description:
              "Shortest quote of the replacement text; null for pure deletions.",
          },
          rationale: {
            type: "string",
            description: "Why, in one or two sentences.",
          },
        },
      },
    },
    review_flags: {
      type: "array",
      items: { type: "string" },
      description:
        "Knock-on effects and judgment calls the lawyer should check: broken cross-references, defined terms now unused, jurisdiction-dependent choices, positions the counterparty will likely push back on.",
    },
    jurisdiction_caveat: {
      type: ["string", "null"],
      description:
        "One sentence when local rules could affect the revisions' enforceability; null otherwise.",
    },
  },
};

const REDLINE_SYSTEM = `You are Justice's redlining assistant for legal professionals. You revise the provided text per the lawyer's instructions and account for every meaningful change — the lawyer stays in control by seeing exactly what moved and why.

Discipline:
- Return the COMPLETE revised document in revised_markdown. Never elide, summarize, or write "[unchanged]" — retained text appears in full.
- Preserve legal effect except where the instructions direct a change. Keep defined terms, cross-references, and numbering consistent; when an edit breaks one elsewhere, either fix it and log that as its own change, or flag it in review_flags.
- changes: one entry per meaningful edit, in document order. Excerpts are the shortest quotes that show the edit; rationale is why, not what.
- Do not editorialize inside the document — commentary belongs in the change log, never in revised_markdown.
- NEVER invent facts or authority. New factual content the instructions didn't supply goes in as a [BRACKETED PLACEHOLDER]; any authority you add is marked "[verify]".
- If an instruction is legally risky or ambiguous, follow the most defensible reading, and say so in review_flags.`;

export type RedlineInput = {
  /** The original document or clause text. */
  original: string;
  /** The lawyer's revision instructions; empty means a general pass. */
  instructions: string;
  jurisdiction: Jurisdiction | null;
};

export async function redlineForLawyer(
  input: RedlineInput,
): Promise<RedlineResult> {
  const jurisdictionLine = hasJurisdiction(input.jurisdiction)
    ? `Jurisdiction: ${formatJurisdiction(input.jurisdiction)}.`
    : "Jurisdiction: not set — flag jurisdiction-dependent revisions in review_flags.";

  const instructions =
    input.instructions.trim() ||
    "General revision pass: improve clarity, internal consistency, and risk allocation for the drafting party without changing the commercial substance.";

  const prompt = [
    jurisdictionLine,
    `The lawyer's instructions:\n"""\n${instructions}\n"""`,
    `The original text:\n"""\n${input.original}\n"""`,
  ].join("\n\n");

  return completeStructured<RedlineResult>({
    system: REDLINE_SYSTEM,
    prompt,
    schemaName: "justice_redline",
    schema: REDLINE_SCHEMA,
    maxTokens: 14_000,
  });
}

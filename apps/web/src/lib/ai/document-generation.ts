import "server-only";
import { completeStructured } from "./provider";
import type { DocTemplate } from "@/lib/generation/templates";
import type { GeneratedDocument } from "@/lib/generation/types";
import {
  formatJurisdiction,
  hasJurisdiction,
  type Jurisdiction,
} from "@/lib/legal/jurisdiction";

/**
 * Document Generation drafting call (Part 4.1 / Phase 6). Text-only
 * structured completion: the template supplies drafting notes + intake
 * answers; the model returns the document as markdown with [PLACEHOLDERS]
 * for anything the user didn't provide. The "Review before use" framing is
 * enforced by the product (UI + exports), not left to the model.
 */

/** Strict JSON schema for a GeneratedDocument — shared with the lawyer
 * drafting call (Phase 7), which produces the same document shape. */
export const GENERATED_DOCUMENT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "body_markdown",
    "placeholders",
    "review_flags",
    "jurisdiction_caveat",
  ],
  properties: {
    title: {
      type: "string",
      description: 'Short document title, e.g. "Demand letter — security deposit".',
    },
    body_markdown: {
      type: "string",
      description:
        "The complete document in markdown. Letters: sender/recipient blocks, date line, subject, body, sign-off. Agreements: numbered clause headings.",
    },
    placeholders: {
      type: "array",
      items: { type: "string" },
      description:
        "Every [BRACKETED PLACEHOLDER] used in the body, listed verbatim.",
    },
    review_flags: {
      type: "array",
      items: { type: "string" },
      description:
        "Judgment calls, jurisdiction-dependent clauses, or assumptions a lawyer (or the user) should check before sending.",
    },
    jurisdiction_caveat: {
      type: ["string", "null"],
      description:
        "One sentence when local rules could change the document's form or deadlines; null otherwise.",
    },
  },
};

const SYSTEM_PROMPT = `You are LexMind's drafting assistant. You produce careful first drafts of common legal documents for people who are not lawyers.

Non-negotiable framing: this is drafting assistance, not legal advice. The product stamps every draft "Review before use" with space for a lawyer's review — do not add your own disclaimer text into the document body.

Drafting discipline:
- NEVER invent facts. Use only what the user provided. Anything missing but needed goes in as a [BRACKETED PLACEHOLDER] (e.g. [DATE LEASE SIGNED]) and is listed in placeholders.
- Plain, professional language. Firm where the document calls for it; never bombastic, never threats beyond lawful consequences.
- Jurisdiction-aware: where a rule, notice period, or formality varies by place, either use the provided jurisdiction's common practice (flagging it in review_flags) or a placeholder plus a review_flags entry. Never state a jurisdiction-varying rule as if universal.
- Structure: letters get sender/recipient blocks, a date line ([DATE] if unknown), subject line, and sign-off; agreements get numbered clauses with headings. End letters with the sender's name; do NOT draw signature lines for agreements — the product appends the signature/review block.
- review_flags must be honest and specific — the judgment calls you actually made.`;

export type GenerateDocumentInput = {
  template: DocTemplate;
  /** Intake answers keyed by field name (already validated/trimmed). */
  answers: Record<string, string>;
  jurisdiction: Jurisdiction | null;
  preferredLanguage?: string | null;
  /** Optional matter context (title + recent AI document summaries). */
  matterTitle?: string | null;
  matterSummaries?: { title: string; summary: string }[];
};

export async function generateDocument(
  input: GenerateDocumentInput,
): Promise<GeneratedDocument> {
  const answerLines = input.template.fields
    .map((f) => {
      const v = input.answers[f.name];
      return v ? `- ${f.label}: ${v}` : null;
    })
    .filter(Boolean) as string[];

  const contextLines: string[] = [];
  if (input.matterTitle) {
    contextLines.push(`This draft belongs to the matter "${input.matterTitle}".`);
  }
  for (const d of input.matterSummaries ?? []) {
    contextLines.push(`Analyzed document on file — "${d.title}": ${d.summary}`);
  }

  const jurisdictionLine = hasJurisdiction(input.jurisdiction)
    ? `Jurisdiction: ${formatJurisdiction(input.jurisdiction)}.`
    : "Jurisdiction: not set — prefer placeholders + review_flags over guessed local rules.";

  const languageLine =
    input.preferredLanguage && input.preferredLanguage !== "en"
      ? `Draft the document in the user's language (code "${input.preferredLanguage}") unless the provided facts are clearly in another language.`
      : "";

  const prompt = [
    `Draft a ${input.template.name.toLowerCase()}.`,
    `Template guidance: ${input.template.draftingNotes}`,
    jurisdictionLine,
    languageLine,
    contextLines.length > 0 ? `Context:\n${contextLines.join("\n")}` : "",
    `The user provided:\n${answerLines.join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return completeStructured<GeneratedDocument>({
    system: SYSTEM_PROMPT,
    prompt,
    schemaName: "lexmind_document_generation",
    schema: GENERATED_DOCUMENT_SCHEMA,
    maxTokens: 6_000,
  });
}

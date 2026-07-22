import "server-only";
import { completeStructured } from "./provider";
import type { CaseBrief, IntakeSubmission } from "@/lib/intake/types";
import { categoryLabel } from "@/lib/matters/categories";
import {
  formatJurisdiction,
  hasJurisdiction,
} from "@/lib/legal/jurisdiction";

/**
 * Triage-to-brief (Phase 8, Part 4.3): the consumer's plain-language intake
 * becomes a structured case brief FOR the lawyer. Same discipline as every
 * Justice AI call: nothing invented — the brief organizes what the client
 * said, it does not embellish it.
 */

const CASE_BRIEF_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "summary",
    "key_facts",
    "timeline",
    "urgency",
    "urgency_reason",
    "complexity_note",
    "questions_for_client",
    "suggested_next_steps",
    "jurisdiction_note",
  ],
  properties: {
    title: {
      type: "string",
      description:
        'Short matter title for the lawyer\'s list, e.g. "Eviction defense — 7-day notice".',
    },
    summary: {
      type: "string",
      description:
        "3–5 sentence professional summary of the client's situation, posture, and what they want.",
    },
    key_facts: {
      type: "array",
      items: { type: "string" },
      description:
        "The material facts the client stated, one per entry, in their logical order. Only stated facts.",
    },
    timeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date_text", "event"],
        properties: {
          date_text: {
            type: "string",
            description:
              'The date exactly as the client gave it ("July 14", "about two weeks ago").',
          },
          event: { type: "string" },
        },
      },
      description: "Only dates/events the client actually mentioned.",
    },
    urgency: {
      type: "string",
      enum: ["low", "medium", "high"],
      description:
        "high = imminent deadline, hearing, or ongoing harm; keyed to what was stated, not assumed.",
    },
    urgency_reason: { type: "string" },
    complexity_note: {
      type: "string",
      description:
        "Honest one–two sentence read on complexity and stakes for triage.",
    },
    questions_for_client: {
      type: "array",
      items: { type: "string" },
      description:
        "The gaps a lawyer would want filled first — specific, answerable questions.",
    },
    suggested_next_steps: {
      type: "array",
      items: { type: "string" },
      description:
        "Concrete first moves for the LAWYER (documents to request, deadlines to verify, filings to check).",
    },
    jurisdiction_note: {
      type: ["string", "null"],
      description:
        "One sentence when the jurisdiction materially shapes the matter; null otherwise.",
    },
  },
};

const INTAKE_SYSTEM = `You are Justice's intake triage assistant. A potential client filled in a lawyer's intake form; you turn their plain-language account into a structured case brief the LAWYER reads first.

Discipline:
- The reader is a legal professional. Professional, neutral tone; no advice to the client, no sympathy filler.
- ONLY what the client stated. Never invent, infer beyond the obvious, or fill gaps — gaps become questions_for_client.
- Quote the client's exact words (briefly, in quotation marks) where the phrasing itself matters.
- Urgency is honest and keyed to stated deadlines, hearings, or ongoing harm — never inflated.
- timeline contains only dates/events the client mentioned, with dates kept exactly as given.
- Do not make legal determinations; frame issues as what appears to be at stake, for the lawyer to assess.`;

export async function triageToBrief(
  intake: IntakeSubmission,
): Promise<CaseBrief> {
  const jurisdiction = { country: intake.country, state: intake.state };
  const jurisdictionLine = hasJurisdiction(jurisdiction)
    ? `Client's jurisdiction: ${formatJurisdiction(jurisdiction)}.`
    : "Client did not provide a jurisdiction — note that in questions_for_client if it matters.";

  const urgencyLabel =
    intake.urgency === "urgent"
      ? "urgent — something is imminent"
      : intake.urgency === "soon"
        ? "needs attention soon"
        : "not time-critical (their own assessment)";

  const prompt = [
    `Category the client chose: ${categoryLabel(intake.category) ?? intake.category}.`,
    jurisdictionLine,
    `Client's own urgency assessment: ${urgencyLabel}.`,
    `Their situation, in their words:\n"""\n${intake.situation}\n"""`,
    intake.key_dates.trim()
      ? `Dates/deadlines they mentioned:\n"""\n${intake.key_dates}\n"""`
      : "",
    intake.desired_outcome.trim()
      ? `What they want to happen:\n"""\n${intake.desired_outcome}\n"""`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return completeStructured<CaseBrief>({
    system: INTAKE_SYSTEM,
    prompt,
    schemaName: "justice_case_brief",
    schema: CASE_BRIEF_SCHEMA,
    maxTokens: 4_000,
  });
}

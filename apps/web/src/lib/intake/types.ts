/** Client-safe types for Client Intake (Phase 8, Part 4.3). */

export type IntakeUrgency = "not_urgent" | "soon" | "urgent";

/** What the consumer fills in on /intake/[token] — plain-language, guided. */
export type IntakeSubmission = {
  /** Their situation, in their own words. */
  situation: string;
  /** Matter category slug (lib/matters/categories). */
  category: string;
  country: string | null;
  state: string | null;
  urgency: IntakeUrgency;
  /** Free text: hearings, notices, deadlines they know about. */
  key_dates: string;
  /** What they want to happen. */
  desired_outcome: string;
};

/** The structured case brief the lawyer reads first (triage-to-brief). */
export type CaseBrief = {
  /** Matter title, e.g. "Eviction defense — 7-day notice". */
  title: string;
  /** Professional 3–5 sentence summary for the lawyer. */
  summary: string;
  key_facts: string[];
  timeline: { date_text: string; event: string }[];
  urgency: "low" | "medium" | "high";
  urgency_reason: string;
  /** Honest read on complexity/stakes for triage. */
  complexity_note: string;
  /** What the lawyer should ask the client first. */
  questions_for_client: string[];
  suggested_next_steps: string[];
  jurisdiction_note: string | null;
};

/** Stored in documents.ai_annotations for the brief (type='generated'),
 * alongside the raw answers so nothing the client said is lost. */
export type IntakeBriefAnnotations = CaseBrief & {
  kind: "intake_brief";
  intake: IntakeSubmission;
};

export function isIntakeBriefAnnotations(
  value: unknown,
): value is IntakeBriefAnnotations {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "intake_brief" &&
    typeof (value as { summary?: unknown }).summary === "string"
  );
}

/** What POST /api/intake/submit returns. */
export type IntakeSubmitResponse = {
  /** Persisted ids when Supabase is configured; null in local preview. */
  matterId: string | null;
  documentId: string | null;
  brief: CaseBrief;
};

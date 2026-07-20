import type { GeneratedDocument } from "@/lib/generation/types";

/** Client-safe types for the lawyer drafting assistant (Phase 7, Part 4.3). */

/** Stored in documents.ai_annotations for lawyer-mode drafts. Same document
 * shape as Phase 6 generation (so GeneratedDocView and exports are reused),
 * distinguished by kind + the drafting doc type. */
export type LawyerDraftAnnotations = GeneratedDocument & {
  kind: "lawyer_draft";
  doc_type: string;
};

export function isLawyerDraftAnnotations(
  value: unknown,
): value is LawyerDraftAnnotations {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "lawyer_draft" &&
    typeof (value as { body_markdown?: unknown }).body_markdown === "string"
  );
}

export type RedlineChangeKind = "substantive" | "risk" | "clarity";

/** One accounted-for edit in a redline — the lawyer stays in control by
 * seeing every change with its rationale, not a silently rewritten text. */
export type RedlineChange = {
  /** Short label, e.g. "Indemnity narrowed to third-party claims". */
  heading: string;
  kind: RedlineChangeKind;
  /** Shortest quote showing what was changed; null for pure insertions. */
  original_excerpt: string | null;
  /** Shortest quote of the replacement; null for pure deletions. */
  revised_excerpt: string | null;
  rationale: string;
};

export type RedlineResult = {
  title: string;
  /** Two–three sentences: overall approach and the riskiest calls. */
  summary: string;
  /** The COMPLETE revised document in markdown — never elided. */
  revised_markdown: string;
  changes: RedlineChange[];
  review_flags: string[];
  jurisdiction_caveat: string | null;
};

/** Stored in documents.ai_annotations for redlines (documents.type stays
 * 'generated' — the schema's check constraint predates redlines; kind
 * disambiguates). */
export type RedlineAnnotations = RedlineResult & { kind: "redline" };

export function isRedlineAnnotations(
  value: unknown,
): value is RedlineAnnotations {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "redline" &&
    typeof (value as { revised_markdown?: unknown }).revised_markdown ===
      "string"
  );
}

/** What POST /api/drafting/draft returns. */
export type LawyerDraftResponse = {
  /** Persisted id when Supabase is configured; null in local preview. */
  documentId: string | null;
  docType: string;
  generated: GeneratedDocument;
};

/** What POST /api/drafting/redline returns. */
export type RedlineResponse = {
  documentId: string | null;
  redline: RedlineResult;
};

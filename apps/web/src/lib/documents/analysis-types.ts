/**
 * Document Intelligence analysis shape (Part 8 "Document Analysis — Structured
 * Output", extended with segment anchors that power the side-by-side
 * highlight-linking UI, Part 5.5). Client-safe: types only, no server imports.
 *
 * The model reconstructs the document's text as ordered, clause-level
 * `segments`; every finding references the segments it came from, so a
 * finding card and its source text can highlight each other reliably —
 * no fuzzy quote matching.
 */

export type DocumentSegment = {
  /** Stable index within this analysis (0-based, in document order). */
  id: number;
  /** Section heading if the document has one at this point. */
  heading: string | null;
  /** Verbatim text of this clause/paragraph. */
  text: string;
};

export type KeyObligation = {
  party: string;
  obligation: string;
  deadline_if_any: string | null;
  segment_ids: number[];
};

export type RiskyClause = {
  clause_excerpt_summary: string;
  why_flagged: string;
  section_reference: string | null;
  /** "high" = genuinely dangerous; "caution" = unusual / worth attention. */
  severity: "caution" | "high";
  segment_ids: number[];
};

export type ImportantDate = {
  label: string;
  /** The date exactly as the document states it. */
  date_text: string;
  /** ISO yyyy-mm-dd when confidently resolvable, else null. */
  iso_date: string | null;
  segment_ids: number[];
};

export type DocumentAnalysis = {
  document_type: string;
  jurisdiction_relevant: boolean;
  /** Caveat when rules likely vary or the jurisdiction is uncertain. */
  jurisdiction_note: string | null;
  detected_language: string;
  plain_language_summary: string;
  /** True if the document was too long to reconstruct fully. */
  truncated: boolean;
  segments: DocumentSegment[];
  key_obligations: KeyObligation[];
  risky_or_unusual_clauses: RiskyClause[];
  important_dates: ImportantDate[];
};

/** What the analyze endpoint returns to the client. */
export type AnalyzeResponse = {
  /** Persisted id when Supabase is configured; null in local preview. */
  documentId: string | null;
  matterId: string | null;
  title: string;
  analysis: DocumentAnalysis;
};

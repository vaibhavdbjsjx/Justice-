/** Client-safe types for Document Generation (Phase 6). */

export type GeneratedDocument = {
  title: string;
  /** The document itself, in markdown. Unknown facts appear as [PLACEHOLDERS]. */
  body_markdown: string;
  /** Placeholder tokens present in the body, for the review checklist. */
  placeholders: string[];
  /** Judgment calls / clauses the drafter flags for human review. */
  review_flags: string[];
  jurisdiction_caveat: string | null;
};

/** What POST /api/documents/generate returns. */
export type GenerateResponse = {
  /** Persisted id when Supabase is configured; null in local preview. */
  documentId: string | null;
  matterId: string | null;
  template: string;
  generated: GeneratedDocument;
};

/** Stored in documents.ai_annotations for type='generated' rows. */
export type GeneratedAnnotations = GeneratedDocument & {
  kind: "generated";
  template: string;
};

export function isGeneratedAnnotations(
  value: unknown,
): value is GeneratedAnnotations {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "generated" &&
    typeof (value as { body_markdown?: unknown }).body_markdown === "string"
  );
}

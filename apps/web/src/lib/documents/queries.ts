import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DocumentRow } from "@/lib/supabase/types";
import type { DocumentAnalysis } from "./analysis-types";

/**
 * Server-side reads for Document Intelligence. RLS scopes rows to matters the
 * viewer can access; demo mode serves ./demo fixtures. `ai_annotations` holds
 * the full DocumentAnalysis; `extracted_text` mirrors the segment text for
 * future search.
 */

export type DocumentListItem = DocumentRow & {
  matterTitle: string | null;
  matterJurisdiction: { country: string | null; state: string | null } | null;
};
export type DocumentDetail = DocumentListItem & { analysis: DocumentAnalysis | null };

type MatterEmbed = {
  title: string;
  jurisdiction_country: string | null;
  jurisdiction_state: string | null;
} | null;

function matterFields(matters: MatterEmbed) {
  return {
    matterTitle: matters?.title ?? null,
    matterJurisdiction: matters
      ? { country: matters.jurisdiction_country, state: matters.jurisdiction_state }
      : null,
  };
}

export async function listDocuments(
  matterId?: string,
): Promise<DocumentListItem[]> {
  if (!isSupabaseConfigured) {
    const { demoDocumentList } = await import("./demo");
    const all = demoDocumentList();
    return matterId ? all.filter((d) => d.matter_id === matterId) : all;
  }

  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select("*, matters(title, jurisdiction_country, jurisdiction_state)")
    .order("created_at", { ascending: false });
  if (matterId) query = query.eq("matter_id", matterId);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const { matters, ...doc } = row as unknown as DocumentRow & {
      matters: MatterEmbed;
    };
    return { ...doc, ...matterFields(matters) };
  });
}

export async function getDocumentDetail(
  documentId: string,
): Promise<DocumentDetail | null> {
  if (!isSupabaseConfigured) {
    const { demoDocumentDetail } = await import("./demo");
    return demoDocumentDetail(documentId);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*, matters(title, jurisdiction_country, jurisdiction_state)")
    .eq("id", documentId)
    .maybeSingle();
  if (!data) return null;

  const { matters, ...doc } = data as unknown as DocumentRow & {
    matters: MatterEmbed;
  };
  return {
    ...doc,
    ...matterFields(matters),
    // Generated drafts store GeneratedAnnotations here, not an analysis.
    analysis:
      doc.type === "uploaded"
        ? ((doc.ai_annotations as unknown as DocumentAnalysis) ?? null)
        : null,
  };
}

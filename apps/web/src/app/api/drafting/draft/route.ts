import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isAiConfigured } from "@/lib/ai/env";
import { AiProviderError } from "@/lib/ai/provider";
import { draftForLawyer } from "@/lib/ai/lawyer-drafting";
import { AI_ERROR_RETRY, AI_NOT_CONFIGURED } from "@/lib/ai/copy";
import { getLawyerDocType } from "@/lib/drafting/doc-types";
import type {
  LawyerDraftAnnotations,
  LawyerDraftResponse,
} from "@/lib/drafting/types";
import { getLicensedJurisdictions } from "@/lib/lawyers/queries";
import { ensureResearchMatter } from "@/lib/matters/default-matter";
import { getViewerTier, upgradeError } from "@/lib/billing/gate";
import { UPGRADE_PROFESSIONAL } from "@/lib/billing/tiers";
import type { Json } from "@/lib/supabase/types";

/**
 * Lawyer drafting endpoint (Phase 7, Part 4.3). Free-form instructions +
 * document-type guidance → a first draft the lawyer stays in control of.
 * Persists into the lawyer's research workspace matter as
 * documents.type='generated' with kind='lawyer_draft' (demo mode: ephemeral).
 */

const MAX_INSTRUCTIONS_CHARS = 12_000;

type DraftRequestBody = {
  docType?: unknown;
  instructions?: unknown;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!isAiConfigured) return jsonError(AI_NOT_CONFIGURED, 503);

  const viewer = await getViewer();
  if (!viewer.user || !viewer.profile) {
    return jsonError("Please sign in to use the drafting assistant.", 401);
  }
  const { profile } = viewer;

  // Drafting is a professional tool (demo previews it, like /research).
  if (profile.role !== "lawyer" && !viewer.isDemo) {
    return jsonError(
      "The drafting assistant is available to legal professionals.",
      403,
    );
  }
  if (!viewer.isDemo && (await getViewerTier(viewer)) !== "professional") {
    return upgradeError(UPGRADE_PROFESSIONAL);
  }

  let body: DraftRequestBody;
  try {
    body = (await request.json()) as DraftRequestBody;
  } catch {
    return jsonError("That request couldn't be read. Please try again.", 400);
  }

  const docType =
    typeof body.docType === "string" ? getLawyerDocType(body.docType) : undefined;
  if (!docType) return jsonError("Choose a document type to draft.", 400);

  const instructions =
    typeof body.instructions === "string" ? body.instructions.trim() : "";
  if (!instructions) {
    return jsonError("Describe what you need drafted.", 400);
  }
  if (instructions.length > MAX_INSTRUCTIONS_CHARS) {
    return jsonError(
      "Those instructions are too long. Please shorten them and try again.",
      400,
    );
  }

  // ---- Context ---------------------------------------------------------------
  let licensedJurisdictions: string[] = [];
  if (isSupabaseConfigured && !viewer.isDemo) {
    try {
      const supabase = await createClient();
      licensedJurisdictions = await getLicensedJurisdictions(
        supabase,
        viewer.user.id,
      );
    } catch (err) {
      console.error("[drafting] licensed jurisdictions lookup failed:", err);
    }
  }

  // ---- Draft -------------------------------------------------------------------
  let generated;
  try {
    generated = await draftForLawyer({
      docType,
      instructions,
      jurisdiction: {
        country: profile.country,
        state: profile.state_province,
      },
      licensedJurisdictions,
    });
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error("[drafting] provider error:", err.status, err.detail);
    } else {
      console.error("[drafting] unexpected error:", err);
    }
    return jsonError(AI_ERROR_RETRY, 502);
  }

  // ---- Persist (demo mode: ephemeral) -----------------------------------------
  let documentId: string | null = null;
  if (isSupabaseConfigured && !viewer.isDemo) {
    try {
      const annotations: LawyerDraftAnnotations = {
        ...generated,
        kind: "lawyer_draft",
        doc_type: docType.slug,
      };
      const supabase = await createClient();
      const matterId = await ensureResearchMatter(
        supabase,
        viewer.user.id,
        profile,
      );
      const { data, error } = await supabase
        .from("documents")
        .insert({
          matter_id: matterId,
          uploaded_by: viewer.user.id,
          type: "generated",
          title: generated.title,
          extracted_text: generated.body_markdown,
          ai_annotations: annotations as unknown as Json,
        })
        .select("id")
        .single();
      if (error) throw error;
      documentId = data.id;
    } catch (err) {
      // Persistence must not cost the lawyer the draft — return it anyway.
      console.error("[drafting] failed to persist draft:", err);
    }
  }

  const responseBody: LawyerDraftResponse = {
    documentId,
    docType: docType.slug,
    generated,
  };
  return Response.json(responseBody);
}

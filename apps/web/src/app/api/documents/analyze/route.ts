import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isAiConfigured } from "@/lib/ai/env";
import { AiProviderError, type AiAttachment } from "@/lib/ai/provider";
import { analyzeDocument } from "@/lib/ai/document-analysis";
import {
  AI_NOT_CONFIGURED,
  DOC_ANALYSIS_FAILED,
  DOC_FILE_INVALID,
} from "@/lib/ai/copy";
import { ensureGeneralMatter } from "@/lib/matters/default-matter";
import { getViewerTier, upgradeError } from "@/lib/billing/gate";
import { UPGRADE_ANALYSIS } from "@/lib/billing/tiers";
import type { AnalyzeResponse } from "@/lib/documents/analysis-types";
import type { Json } from "@/lib/supabase/types";

/**
 * Document Intelligence endpoint (Phase 5, Part 4.1). Multipart upload →
 * one multimodal structured AI call → persisted analysis (Supabase
 * configured) or an ephemeral result (demo mode).
 *
 * Storage note: the original binary is NOT persisted yet — no cloud Supabase
 * project/storage bucket exists. The verbatim extracted segments + analysis
 * are what the product needs (the side-by-side view renders text, not the
 * binary); blob archival lands with the cloud project (BUILD_LOG deferral).
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_TITLE_CHARS = 160;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!isAiConfigured) return jsonError(AI_NOT_CONFIGURED, 503);

  const viewer = await getViewer();
  if (!viewer.user || !viewer.profile) {
    return jsonError("Please sign in to analyze documents.", 401);
  }
  const { profile } = viewer;

  // Document Intelligence is a paid feature (Phase 10; demo previews it).
  if (!viewer.isDemo && (await getViewerTier(viewer)) === "free") {
    return upgradeError(UPGRADE_ANALYSIS);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(DOC_FILE_INVALID, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError(DOC_FILE_INVALID, 400);
  }
  if (file.size > MAX_FILE_BYTES) return jsonError(DOC_FILE_INVALID, 413);

  const isPdf = file.type === "application/pdf";
  if (!isPdf && !IMAGE_TYPES.has(file.type)) {
    return jsonError(DOC_FILE_INVALID, 415);
  }

  const rawTitle = form.get("title");
  const fallbackTitle = file.name.replace(/\.[^.]+$/, "").trim() || "Document";
  const title = (
    (typeof rawTitle === "string" && rawTitle.trim()) || fallbackTitle
  ).slice(0, MAX_TITLE_CHARS);

  const requestedMatterId = form.get("matterId");
  const matterIdParam =
    typeof requestedMatterId === "string" && requestedMatterId
      ? requestedMatterId
      : null;

  // ---- Resolve the matter (scope + jurisdiction) ---------------------------
  let matterId: string | null = null;
  let jurisdiction = {
    country: profile.country,
    state: profile.state_province,
  };

  if (isSupabaseConfigured && !viewer.isDemo) {
    const supabase = await createClient();
    try {
      if (matterIdParam) {
        const { data: matter } = await supabase
          .from("matters")
          .select("id, jurisdiction_country, jurisdiction_state")
          .eq("id", matterIdParam)
          .eq("user_id", viewer.user.id)
          .maybeSingle();
        if (!matter) return jsonError("That matter isn't available.", 404);
        matterId = matter.id;
        jurisdiction = {
          country: matter.jurisdiction_country,
          state: matter.jurisdiction_state,
        };
      } else {
        matterId = await ensureGeneralMatter(supabase, viewer.user.id, profile);
      }
    } catch (err) {
      console.error("[documents] matter resolution failed:", err);
      return jsonError(DOC_ANALYSIS_FAILED, 500);
    }
  } else if (matterIdParam) {
    const { demoMatterDetail } = await import("@/lib/matters/demo");
    const demo = demoMatterDetail(matterIdParam);
    if (demo) {
      jurisdiction = {
        country: demo.matter.jurisdiction_country,
        state: demo.matter.jurisdiction_state,
      };
    }
  }

  // ---- Analyze -------------------------------------------------------------
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const attachment: AiAttachment = isPdf
    ? { kind: "pdf", filename: file.name || "document.pdf", base64 }
    : { kind: "image", mediaType: file.type, base64 };

  let analysis;
  try {
    analysis = await analyzeDocument({
      attachment,
      jurisdiction,
      preferredLanguage: profile.preferred_language,
    });
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error("[documents] provider error:", err.status, err.detail);
    } else {
      console.error("[documents] unexpected analysis error:", err);
    }
    return jsonError(DOC_ANALYSIS_FAILED, 502);
  }

  // ---- Persist (skipped in demo mode; a failure never loses the analysis) --
  let documentId: string | null = null;
  if (isSupabaseConfigured && !viewer.isDemo && matterId) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("documents")
        .insert({
          matter_id: matterId,
          uploaded_by: viewer.user.id,
          type: "uploaded",
          title,
          extracted_text: analysis.segments.map((s) => s.text).join("\n\n"),
          ai_annotations: analysis as unknown as Json,
        })
        .select("id")
        .single();
      if (error) throw error;
      documentId = data.id;
    } catch (err) {
      console.error("[documents] failed to persist analysis:", err);
    }
  }

  const body: AnalyzeResponse = { documentId, matterId, title, analysis };
  return Response.json(body);
}

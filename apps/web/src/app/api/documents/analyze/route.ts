import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isAiConfigured } from "@/lib/ai/env";
import { aiConsentRequired, needsAiConsent } from "@/lib/ai/consent";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction";
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
 * Hosted functions reject request bodies over roughly 4.5 MB before this code
 * runs, so a larger file arrives as JSON naming an object the user uploaded to
 * their own storage folder. It's removed once read: the verbatim segments and
 * analysis are what the product keeps, not the binary.
 */

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const UPLOAD_BUCKET = "document-uploads";
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

  if (!viewer.isDemo && needsAiConsent(profile)) return aiConsentRequired();

  // Document Intelligence is a paid feature (Phase 10; demo previews it).
  if (!viewer.isDemo && (await getViewerTier(viewer)) === "free") {
    return upgradeError(UPGRADE_ANALYSIS);
  }

  let file: { bytes: ArrayBuffer; name: string; type: string; size: number };
  let rawTitle: unknown;
  let requestedMatterId: unknown;
  let uploadedPath: string | null = null;

  if (request.headers.get("content-type")?.includes("application/json")) {
    let body: {
      storagePath?: unknown;
      filename?: unknown;
      mimeType?: unknown;
      title?: unknown;
      matterId?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonError(DOC_FILE_INVALID, 400);
    }
    // RLS scopes the read as well; the prefix check keeps the error calm.
    if (
      typeof body.storagePath !== "string" ||
      !body.storagePath.startsWith(`${viewer.user.id}/`) ||
      !isSupabaseConfigured
    ) {
      return jsonError(DOC_FILE_INVALID, 400);
    }
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(UPLOAD_BUCKET)
      .download(body.storagePath);
    if (error || !data) {
      console.error("[documents] storage download failed:", error);
      return jsonError(DOC_FILE_INVALID, 400);
    }
    uploadedPath = body.storagePath;
    file = {
      bytes: await data.arrayBuffer(),
      name: typeof body.filename === "string" ? body.filename : "document",
      type: typeof body.mimeType === "string" ? body.mimeType : data.type,
      size: data.size,
    };
    rawTitle = body.title;
    requestedMatterId = body.matterId;
  } else {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError(DOC_FILE_INVALID, 400);
    }
    const part = form.get("file");
    if (!(part instanceof File)) return jsonError(DOC_FILE_INVALID, 400);
    file = {
      bytes: await part.arrayBuffer(),
      name: part.name,
      type: part.type,
      size: part.size,
    };
    rawTitle = form.get("title");
    requestedMatterId = form.get("matterId");
  }

  if (file.size === 0) return jsonError(DOC_FILE_INVALID, 400);
  if (file.size > MAX_FILE_BYTES) return jsonError(DOC_FILE_INVALID, 413);

  const isPdf = file.type === "application/pdf";
  if (!isPdf && !IMAGE_TYPES.has(file.type)) {
    return jsonError(DOC_FILE_INVALID, 415);
  }

  const fallbackTitle = file.name.replace(/\.[^.]+$/, "").trim() || "Document";
  const title = (
    (typeof rawTitle === "string" && rawTitle.trim()) || fallbackTitle
  ).slice(0, MAX_TITLE_CHARS);

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
        jurisdiction = resolveJurisdiction(matter, profile);
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
  const base64 = Buffer.from(file.bytes).toString("base64");
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
  } finally {
    if (uploadedPath) {
      const supabase = await createClient();
      const { error } = await supabase.storage
        .from(UPLOAD_BUCKET)
        .remove([uploadedPath]);
      if (error) console.error("[documents] upload cleanup failed:", error);
    }
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

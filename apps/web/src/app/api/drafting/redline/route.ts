import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isAiConfigured } from "@/lib/ai/env";
import { AiProviderError } from "@/lib/ai/provider";
import { redlineForLawyer } from "@/lib/ai/lawyer-drafting";
import { AI_ERROR_RETRY, AI_NOT_CONFIGURED } from "@/lib/ai/copy";
import type {
  RedlineAnnotations,
  RedlineResponse,
} from "@/lib/drafting/types";
import { ensureResearchMatter } from "@/lib/matters/default-matter";
import { getViewerTier, upgradeError } from "@/lib/billing/gate";
import { UPGRADE_PROFESSIONAL } from "@/lib/billing/tiers";
import type { Json } from "@/lib/supabase/types";

/**
 * Lawyer redlining endpoint (Phase 7, Part 4.3): original text + instructions
 * → complete revised draft with an accounted-for change log. Persists like
 * drafts (documents.type='generated', kind='redline'); demo mode: ephemeral.
 */

const MAX_ORIGINAL_CHARS = 24_000;
const MAX_INSTRUCTIONS_CHARS = 8_000;

type RedlineRequestBody = {
  original?: unknown;
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

  if (profile.role !== "lawyer" && !viewer.isDemo) {
    return jsonError(
      "The drafting assistant is available to legal professionals.",
      403,
    );
  }
  if (!viewer.isDemo && (await getViewerTier(viewer)) !== "professional") {
    return upgradeError(UPGRADE_PROFESSIONAL);
  }

  let body: RedlineRequestBody;
  try {
    body = (await request.json()) as RedlineRequestBody;
  } catch {
    return jsonError("That request couldn't be read. Please try again.", 400);
  }

  const original =
    typeof body.original === "string" ? body.original.trim() : "";
  if (!original) {
    return jsonError("Paste the text you want revised.", 400);
  }
  if (original.length > MAX_ORIGINAL_CHARS) {
    return jsonError(
      "That text is too long for one pass. Please redline it in sections.",
      400,
    );
  }

  const instructions =
    typeof body.instructions === "string" ? body.instructions.trim() : "";
  if (instructions.length > MAX_INSTRUCTIONS_CHARS) {
    return jsonError(
      "Those instructions are too long. Please shorten them and try again.",
      400,
    );
  }

  // ---- Redline -----------------------------------------------------------------
  let redline;
  try {
    redline = await redlineForLawyer({
      original,
      instructions,
      jurisdiction: {
        country: profile.country,
        state: profile.state_province,
      },
    });
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error("[redline] provider error:", err.status, err.detail);
    } else {
      console.error("[redline] unexpected error:", err);
    }
    return jsonError(AI_ERROR_RETRY, 502);
  }

  // ---- Persist (demo mode: ephemeral) -------------------------------------------
  let documentId: string | null = null;
  if (isSupabaseConfigured && !viewer.isDemo) {
    try {
      const annotations: RedlineAnnotations = { ...redline, kind: "redline" };
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
          title: redline.title,
          extracted_text: redline.revised_markdown,
          ai_annotations: annotations as unknown as Json,
        })
        .select("id")
        .single();
      if (error) throw error;
      documentId = data.id;
    } catch (err) {
      console.error("[redline] failed to persist revision:", err);
    }
  }

  const responseBody: RedlineResponse = { documentId, redline };
  return Response.json(responseBody);
}

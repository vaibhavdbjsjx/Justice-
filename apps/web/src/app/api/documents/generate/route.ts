import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isAiConfigured } from "@/lib/ai/env";
import { AiProviderError } from "@/lib/ai/provider";
import { generateDocument } from "@/lib/ai/document-generation";
import { AI_ERROR_RETRY, AI_NOT_CONFIGURED } from "@/lib/ai/copy";
import { getTemplate } from "@/lib/generation/templates";
import type {
  GeneratedAnnotations,
  GenerateResponse,
} from "@/lib/generation/types";
import { ensureGeneralMatter } from "@/lib/matters/default-matter";
import { getViewerTier, upgradeError } from "@/lib/billing/gate";
import { countGeneratedDocsThisMonth } from "@/lib/billing/usage";
import {
  FREE_GENERATED_DOCS_PER_MONTH,
  UPGRADE_GENERATION_LIMIT,
} from "@/lib/billing/tiers";
import type { Json } from "@/lib/supabase/types";

/**
 * Document Generation endpoint (Phase 6). Template + intake answers +
 * optional matter context → drafted document, persisted as
 * documents.type='generated' (demo mode: ephemeral).
 */

const MAX_FIELD_CHARS = 4_000;

type GenerateRequestBody = {
  template?: unknown;
  answers?: unknown;
  matterId?: unknown;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!isAiConfigured) return jsonError(AI_NOT_CONFIGURED, 503);

  const viewer = await getViewer();
  if (!viewer.user || !viewer.profile) {
    return jsonError("Please sign in to generate documents.", 401);
  }
  const { profile } = viewer;

  // Free tier: a monthly allowance of template drafts (Phase 10).
  if (!viewer.isDemo && isSupabaseConfigured) {
    const tier = await getViewerTier(viewer);
    if (tier === "free") {
      const supabase = await createClient();
      const used = await countGeneratedDocsThisMonth(supabase, viewer.user.id);
      if (used >= FREE_GENERATED_DOCS_PER_MONTH) {
        return upgradeError(UPGRADE_GENERATION_LIMIT);
      }
    }
  }

  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return jsonError("That request couldn't be read. Please try again.", 400);
  }

  const template =
    typeof body.template === "string" ? getTemplate(body.template) : undefined;
  if (!template) return jsonError("Choose a document type to generate.", 400);

  // Sanitize answers: known fields only, trimmed and capped.
  const rawAnswers =
    typeof body.answers === "object" && body.answers !== null
      ? (body.answers as Record<string, unknown>)
      : {};
  const answers: Record<string, string> = {};
  for (const field of template.fields) {
    const v = rawAnswers[field.name];
    if (typeof v === "string" && v.trim()) {
      answers[field.name] = v.trim().slice(0, MAX_FIELD_CHARS);
    }
  }
  const missing = template.fields.filter((f) => f.required && !answers[f.name]);
  if (missing.length > 0) {
    return jsonError(`Please fill in: ${missing.map((f) => f.label).join(", ")}.`, 400);
  }

  const requestedMatterId =
    typeof body.matterId === "string" && body.matterId ? body.matterId : null;

  // ---- Matter scope (jurisdiction + document context) ----------------------
  let matterId: string | null = null;
  let matterTitle: string | null = null;
  let matterSummaries: { title: string; summary: string }[] = [];
  let jurisdiction = {
    country: profile.country,
    state: profile.state_province,
  };

  if (isSupabaseConfigured && !viewer.isDemo) {
    const supabase = await createClient();
    try {
      if (requestedMatterId) {
        const { data: matter } = await supabase
          .from("matters")
          .select("id, title, jurisdiction_country, jurisdiction_state")
          .eq("id", requestedMatterId)
          .eq("user_id", viewer.user.id)
          .maybeSingle();
        if (!matter) return jsonError("That matter isn't available.", 404);
        matterId = matter.id;
        matterTitle = matter.title;
        jurisdiction = {
          country: matter.jurisdiction_country,
          state: matter.jurisdiction_state,
        };
        const { data: docs } = await supabase
          .from("documents")
          .select("title, ai_annotations")
          .eq("matter_id", matter.id)
          .eq("type", "uploaded")
          .order("created_at", { ascending: false })
          .limit(3);
        matterSummaries = (docs ?? []).flatMap((d) => {
          const summary = (
            d.ai_annotations as { plain_language_summary?: string } | null
          )?.plain_language_summary;
          return summary ? [{ title: d.title ?? "Document", summary }] : [];
        });
      } else {
        matterId = await ensureGeneralMatter(supabase, viewer.user.id, profile);
      }
    } catch (err) {
      console.error("[generate] matter resolution failed:", err);
      return jsonError(AI_ERROR_RETRY, 500);
    }
  } else if (requestedMatterId) {
    const { demoMatterDetail } = await import("@/lib/matters/demo");
    const demo = demoMatterDetail(requestedMatterId);
    if (demo) {
      matterTitle = demo.matter.title;
      jurisdiction = {
        country: demo.matter.jurisdiction_country,
        state: demo.matter.jurisdiction_state,
      };
    }
  }

  // ---- Draft ----------------------------------------------------------------
  let generated;
  try {
    generated = await generateDocument({
      template,
      answers,
      jurisdiction,
      preferredLanguage: profile.preferred_language,
      matterTitle,
      matterSummaries,
    });
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error("[generate] provider error:", err.status, err.detail);
    } else {
      console.error("[generate] unexpected error:", err);
    }
    return jsonError(AI_ERROR_RETRY, 502);
  }

  // ---- Persist (demo mode: ephemeral) ---------------------------------------
  let documentId: string | null = null;
  if (isSupabaseConfigured && !viewer.isDemo && matterId) {
    try {
      const annotations: GeneratedAnnotations = {
        ...generated,
        kind: "generated",
        template: template.slug,
      };
      const supabase = await createClient();
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
      console.error("[generate] failed to persist draft:", err);
    }
  }

  const responseBody: GenerateResponse = {
    documentId,
    matterId,
    template: template.slug,
    generated,
  };
  return Response.json(responseBody);
}

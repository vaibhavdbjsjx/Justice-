import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isAiConfigured } from "@/lib/ai/env";
import { AiProviderError } from "@/lib/ai/provider";
import { triageToBrief } from "@/lib/ai/intake";
import { AI_ERROR_RETRY, AI_NOT_CONFIGURED } from "@/lib/ai/copy";
import { resolveIntakeToken } from "@/lib/intake/queries";
import { isKnownCategory } from "@/lib/matters/categories";
import type {
  IntakeBriefAnnotations,
  IntakeSubmission,
  IntakeSubmitResponse,
  IntakeUrgency,
} from "@/lib/intake/types";
import type { Json } from "@/lib/supabase/types";

/**
 * Intake submission (Phase 8, Part 4.3): token-validated triage-to-brief.
 * The CLIENT creates everything under their own RLS identity — the matter
 * (matters_insert_own), the share (lcl_insert_by_client_owner, status
 * 'active': the lawyer published the link, the client used it — mutual
 * consent), and the brief document. The token's only privileged use is
 * resolving which lawyer it belongs to (service role, server-side).
 */

const MAX_SITUATION_CHARS = 8_000;
const MAX_SHORT_FIELD_CHARS = 2_000;

type SubmitBody = {
  token?: unknown;
  situation?: unknown;
  category?: unknown;
  country?: unknown;
  state?: unknown;
  urgency?: unknown;
  key_dates?: unknown;
  desired_outcome?: unknown;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Markdown mirror of the brief for documents.extracted_text (search later). */
function briefToMarkdown(brief: {
  summary: string;
  key_facts: string[];
  timeline: { date_text: string; event: string }[];
}): string {
  return [
    brief.summary,
    "",
    "## Key facts",
    ...brief.key_facts.map((f) => `- ${f}`),
    ...(brief.timeline.length > 0
      ? ["", "## Timeline", ...brief.timeline.map((t) => `- ${t.date_text}: ${t.event}`)]
      : []),
  ].join("\n");
}

export async function POST(request: Request): Promise<Response> {
  if (!isAiConfigured) return jsonError(AI_NOT_CONFIGURED, 503);

  const viewer = await getViewer();
  if (!viewer.user || !viewer.profile) {
    return jsonError("Please sign in to send your information.", 401);
  }

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return jsonError("That request couldn't be read. Please try again.", 400);
  }

  const token = str(body.token, 200);
  const branding = token ? await resolveIntakeToken(token) : null;
  if (!branding) {
    return jsonError(
      "This intake link is no longer active. Please ask the lawyer for a new one.",
      404,
    );
  }
  if (branding.lawyerId === viewer.user.id) {
    return jsonError("This is your own intake link — share it with clients.", 400);
  }

  const situation = str(body.situation, MAX_SITUATION_CHARS);
  if (!situation) {
    return jsonError("Please describe your situation first.", 400);
  }
  const category =
    typeof body.category === "string" && isKnownCategory(body.category)
      ? body.category
      : "other";
  const urgency: IntakeUrgency =
    body.urgency === "urgent" || body.urgency === "soon"
      ? body.urgency
      : "not_urgent";

  const intake: IntakeSubmission = {
    situation,
    category,
    country: str(body.country, 120) || null,
    state: str(body.state, 120) || null,
    urgency,
    key_dates: str(body.key_dates, MAX_SHORT_FIELD_CHARS),
    desired_outcome: str(body.desired_outcome, MAX_SHORT_FIELD_CHARS),
  };

  // ---- Triage-to-brief --------------------------------------------------------
  let brief;
  try {
    brief = await triageToBrief(intake);
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error("[intake] provider error:", err.status, err.detail);
    } else {
      console.error("[intake] unexpected error:", err);
    }
    return jsonError(AI_ERROR_RETRY, 502);
  }

  // ---- Persist matter + share + brief (demo mode: ephemeral) -------------------
  let matterId: string | null = null;
  let documentId: string | null = null;
  if (isSupabaseConfigured && !viewer.isDemo) {
    try {
      const supabase = await createClient();

      const { data: matter, error: matterError } = await supabase
        .from("matters")
        .insert({
          user_id: viewer.user.id,
          title: brief.title,
          category: intake.category,
          jurisdiction_country: intake.country,
          jurisdiction_state: intake.state,
        })
        .select("id")
        .single();
      if (matterError) throw matterError;
      matterId = matter.id;

      const { error: linkError } = await supabase
        .from("lawyer_client_links")
        .insert({
          lawyer_id: branding.lawyerId,
          client_id: viewer.user.id,
          matter_id: matter.id,
          status: "active",
        });
      if (linkError) throw linkError;

      const annotations: IntakeBriefAnnotations = {
        ...brief,
        kind: "intake_brief",
        intake,
      };
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          matter_id: matter.id,
          uploaded_by: viewer.user.id,
          type: "generated",
          title: `Case brief — ${brief.title}`,
          extracted_text: briefToMarkdown(brief),
          ai_annotations: annotations as unknown as Json,
        })
        .select("id")
        .single();
      if (docError) throw docError;
      documentId = doc.id;
    } catch (err) {
      // The brief must reach the client even if persistence hiccups.
      console.error("[intake] failed to persist:", err);
      matterId = null;
      documentId = null;
    }
  }

  const responseBody: IntakeSubmitResponse = { matterId, documentId, brief };
  return Response.json(responseBody);
}

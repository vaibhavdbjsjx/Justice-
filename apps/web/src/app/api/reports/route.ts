import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const KINDS = new Set(["ai_answer", "ai_document", "lawyer_profile", "other"]);
const MAX_REASON = 120;
const MAX_DETAILS = 2_000;
const MAX_EXCERPT = 4_000;

/**
 * Report an AI answer or a marketplace profile (App Store Guideline 1.2 asks for
 * a way to report content and a timely response). Reports land in
 * public.content_reports, and the support team works through the open ones.
 */
export async function POST(request: Request): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer.user) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "That report couldn't be read." }, { status: 400 });
  }

  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!kind || !reason) {
    return Response.json({ error: "Choose a reason for this report." }, { status: 400 });
  }

  if (viewer.isDemo) return Response.json({ ok: true });

  const text = (value: unknown, max: number) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

  const supabase = await createClient();
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: viewer.user.id,
    kind,
    reason: reason.slice(0, MAX_REASON),
    details: text(body.details, MAX_DETAILS),
    reference_id: text(body.referenceId, 200),
    content_excerpt: text(body.excerpt, MAX_EXCERPT),
  });

  if (error) {
    console.error("[reports] failed to save:", error);
    return Response.json(
      { error: "We couldn't send that report just now. Please try again." },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}

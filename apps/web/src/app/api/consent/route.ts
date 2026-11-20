import { getViewer } from "@/lib/auth/session";
import { AI_PROVIDER } from "@/lib/ai/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Records or withdraws permission to share content with the third-party AI
 * (App Store Guideline 5.1.2(i)). POST grants, DELETE withdraws.
 */
async function setConsent(granted: boolean): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer.user) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }
  if (viewer.isDemo) return Response.json({ ok: true });

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      ai_consent_at: granted ? new Date().toISOString() : null,
      ai_consent_provider: granted ? AI_PROVIDER : null,
    })
    .eq("user_id", viewer.user.id);

  if (error) {
    console.error("[consent] failed to record:", error);
    return Response.json(
      { error: "We couldn't save that just now. Please try again." },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}

export function POST(): Promise<Response> {
  return setConsent(true);
}

export function DELETE(): Promise<Response> {
  return setConsent(false);
}

import { getViewer } from "@/lib/auth/session";
import { getViewerTier, upgradeError } from "@/lib/billing/gate";
import { FREE_ACTIVE_MATTERS, UPGRADE_MATTER_LIMIT } from "@/lib/billing/tiers";
import { countActiveSelfMatters } from "@/lib/billing/usage";
import { isKnownCategory } from "@/lib/matters/categories";
import { createClient } from "@/lib/supabase/server";

const MAX_TITLE_CHARS = 200;

const optional = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Creates a matter for the mobile app with the same plan limit as the web's
 * createMatter action. A matter without its own jurisdiction takes the person's.
 */
export async function POST(request: Request): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.profile) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  const title = optional(body.title);
  const category = optional(body.category);
  if (!title) {
    return Response.json({ error: "Give the matter a short title." }, { status: 400 });
  }
  if (title.length > MAX_TITLE_CHARS) {
    return Response.json(
      { error: "That title is a little long. Please shorten it." },
      { status: 400 },
    );
  }
  if (!category || !isKnownCategory(category)) {
    return Response.json({ error: "Choose a category for this matter." }, { status: 400 });
  }

  const supabase = await createClient();
  if ((await getViewerTier(viewer)) === "free") {
    const active = await countActiveSelfMatters(supabase, viewer.user.id);
    if (active >= FREE_ACTIVE_MATTERS) return upgradeError(UPGRADE_MATTER_LIMIT);
  }

  const { data, error } = await supabase
    .from("matters")
    .insert({
      user_id: viewer.user.id,
      title,
      category,
      jurisdiction_country: optional(body.jurisdictionCountry) ?? viewer.profile.country,
      jurisdiction_state: optional(body.jurisdictionCountry)
        ? optional(body.jurisdictionState)
        : viewer.profile.state_province,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[matters] create failed:", error);
    return Response.json(
      { error: "That couldn't be saved. Please try again." },
      { status: 500 },
    );
  }
  return Response.json({ matter: data });
}

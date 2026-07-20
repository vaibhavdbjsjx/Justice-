import { getViewer } from "@/lib/auth/session";
import { DOC_TEMPLATES } from "@/lib/generation/templates";

/**
 * Template registry for clients that can't import it (Flutter, Phase 12).
 * The web wizard imports lib/generation/templates.ts directly; this route
 * serves the same objects, so there is exactly one registry. Auth-gated
 * like every product endpoint; drafting notes stay server-side (they are
 * prompt guidance, not client copy).
 */
export async function GET(): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer.user) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }
  return Response.json({
    templates: DOC_TEMPLATES.map(({ slug, name, description, fields }) => ({
      slug,
      name,
      description,
      fields,
    })),
  });
}

import { bearerToken, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/lib/supabase/types";

export type Viewer = {
  user: { id: string; email: string | null } | null;
  profile: Profile | null;
  /** True when Supabase isn't configured — we render a preview with demo data. */
  isDemo: boolean;
};

/** Demo profile used ONLY when Supabase is unconfigured (local preview). */
const DEMO_PROFILE: Profile = {
  user_id: "00000000-0000-0000-0000-000000000000",
  role: "consumer",
  full_name: "Preview User",
  country: "United States",
  state_province: "California",
  preferred_language: "en",
  onboarding_completed: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Resolves the current viewer for Server Components / layouts. When Supabase is
 * not configured, returns a demo viewer so the authenticated UI is previewable
 * locally (never active in production, where env is set).
 */
export async function getViewer(): Promise<Viewer> {
  if (!isSupabaseConfigured) {
    return {
      user: { id: DEMO_PROFILE.user_id, email: "preview@lexmind.app" },
      profile: DEMO_PROFILE,
      isDemo: true,
    };
  }

  const supabase = await createClient();
  // Mobile requests (Phase 12) carry a bearer token instead of cookies —
  // validate it explicitly; auth.getUser() alone only knows cookie sessions.
  const bearer = await bearerToken();
  const {
    data: { user },
  } = bearer
    ? await supabase.auth.getUser(bearer)
    : await supabase.auth.getUser();

  if (!user) return { user: null, profile: null, isDemo: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email ?? null },
    profile: profile ?? null,
    isDemo: false,
  };
}

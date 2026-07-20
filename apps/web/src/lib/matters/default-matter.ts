import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/supabase/types";
import { GENERAL_CATEGORY } from "./categories";

export const DEFAULT_MATTER_TITLE = "General consultation";

/** Home of the lawyer research chat (Phase 7). Not user-pickable. */
export const RESEARCH_CATEGORY = "research";
export const RESEARCH_MATTER_TITLE = "Research workspace";

/**
 * Finds (or lazily creates) one of the viewer's default matters — the home
 * for un-scoped consumer chat / quick uploads ("general") or the lawyer's
 * research chat ("research"). `chat_messages`/`documents` require a matter,
 * and RLS derives access from it (Phase 3 decision). Caller must pass a
 * user-scoped client.
 */
async function ensureDefaultMatter(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: Pick<Profile, "country" | "state_province">,
  category: string,
  title: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("matters")
    .select("id")
    .eq("user_id", userId)
    .eq("category", category)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("matters")
    .insert({
      user_id: userId,
      title,
      category,
      jurisdiction_country: profile.country,
      jurisdiction_state: profile.state_province,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export async function ensureGeneralMatter(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: Pick<Profile, "country" | "state_province">,
): Promise<string> {
  return ensureDefaultMatter(
    supabase,
    userId,
    profile,
    GENERAL_CATEGORY,
    DEFAULT_MATTER_TITLE,
  );
}

export async function ensureResearchMatter(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: Pick<Profile, "country" | "state_province">,
): Promise<string> {
  return ensureDefaultMatter(
    supabase,
    userId,
    profile,
    RESEARCH_CATEGORY,
    RESEARCH_MATTER_TITLE,
  );
}

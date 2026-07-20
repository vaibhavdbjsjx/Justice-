import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { GENERAL_CATEGORY } from "@/lib/matters/categories";
import { RESEARCH_CATEGORY } from "@/lib/matters/default-matter";

/**
 * Free-tier usage metering (Phase 10) — derived live from existing tables,
 * no counters to drift. All counts are the caller's own rows (RLS-scoped).
 */

export function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** User-authored chat messages this calendar month (assistant turns free). */
export async function countChatMessagesThisMonth(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", monthStartIso());
  return count ?? 0;
}

/** Active matters the user opened themselves (the defaults don't count). */
export async function countActiveSelfMatters(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("matters")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
    .not("category", "in", `(${GENERAL_CATEGORY},${RESEARCH_CATEGORY})`);
  return count ?? 0;
}

/** Consumer template drafts this month (kind='generated' only — lawyer
 * drafts are Professional-gated and intake briefs are exempt by design). */
export async function countGeneratedDocsThisMonth(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("uploaded_by", userId)
    .eq("type", "generated")
    .eq("ai_annotations->>kind", "generated")
    .gte("created_at", monthStartIso());
  return count ?? 0;
}

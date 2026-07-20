import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Viewer } from "@/lib/auth/session";
import type { Subscription } from "@/lib/supabase/types";
import type { Tier } from "./tiers";

/**
 * Effective-tier resolution (Phase 10). One rule everywhere:
 * a paid tier counts only while its subscription status is in grace
 * ('active' covers trialing; 'past_due' keeps access while Stripe retries).
 * Demo mode (Supabase unconfigured) previews everything — gates, like role
 * checks, apply to real accounts.
 */

const EFFECTIVE_STATUSES = new Set(["active", "past_due"]);

export function effectiveTier(sub: Pick<Subscription, "tier" | "status"> | null): Tier {
  if (!sub) return "free";
  if (sub.tier === "free") return "free";
  return EFFECTIVE_STATUSES.has(sub.status) ? sub.tier : "free";
}

export async function getSubscription(): Promise<Subscription | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
}

/** The tier gates should enforce for this viewer. Demo previews as paid. */
export async function getViewerTier(viewer: Viewer): Promise<Tier> {
  // Demo mode is a full-product preview (it renders BOTH consumer and lawyer
  // surfaces regardless of the demo profile's role), so nothing should read
  // as locked — resolve to the top tier. /billing displays "free" for demo
  // separately so its usage meters + upgrade card still preview.
  if (viewer.isDemo) return "professional";
  return effectiveTier(await getSubscription());
}

/** Tier lookup for server actions that already hold a user-scoped client. */
export async function getTierFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Tier> {
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", userId)
    .maybeSingle();
  return effectiveTier(data);
}

/** Standard gate error payload — `upgrade: true` lets clients link /billing. */
export function upgradeError(message: string, status = 402): Response {
  return Response.json({ error: message, upgrade: true }, { status });
}

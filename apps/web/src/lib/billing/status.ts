import "server-only";
import type { Viewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { effectiveTier, getSubscription, getViewerTier } from "./gate";
import {
  FREE_ACTIVE_MATTERS,
  FREE_CHAT_MESSAGES_PER_MONTH,
  FREE_GENERATED_DOCS_PER_MONTH,
  PAYMENTS_ENABLED,
  type Tier,
} from "./tiers";
import {
  countActiveSelfMatters,
  countChatMessagesThisMonth,
  countGeneratedDocsThisMonth,
} from "./usage";

export type BillingStatus = {
  tier: Tier;
  /** Where a paid plan was bought: "apple", "stripe", or null when free. */
  source: string | null;
  renewsAt: string | null;
  paymentsEnabled: boolean;
  limits: { chatMessages: number; activeMatters: number; generatedDocs: number };
  usage: { chatMessages: number; activeMatters: number; generatedDocs: number };
};

/** The plan and allowance view the app renders, computed live. */
export async function getBillingStatus(viewer: Viewer): Promise<BillingStatus> {
  const limits = {
    chatMessages: FREE_CHAT_MESSAGES_PER_MONTH,
    activeMatters: FREE_ACTIVE_MATTERS,
    generatedDocs: FREE_GENERATED_DOCS_PER_MONTH,
  };
  const usage = { chatMessages: 0, activeMatters: 0, generatedDocs: 0 };

  if (!isSupabaseConfigured || viewer.isDemo || !viewer.user) {
    return {
      tier: await getViewerTier(viewer),
      source: null,
      renewsAt: null,
      paymentsEnabled: PAYMENTS_ENABLED,
      limits,
      usage,
    };
  }

  const supabase = await createClient();
  const subscription = await getSubscription();
  const [chatMessages, activeMatters, generatedDocs] = await Promise.all([
    countChatMessagesThisMonth(supabase, viewer.user.id),
    countActiveSelfMatters(supabase, viewer.user.id),
    countGeneratedDocsThisMonth(supabase, viewer.user.id),
  ]);
  const paid = effectiveTier(subscription) !== "free";

  return {
    tier: await getViewerTier(viewer),
    source: paid ? (subscription?.source ?? "stripe") : null,
    renewsAt: paid ? (subscription?.renews_at ?? null) : null,
    paymentsEnabled: PAYMENTS_ENABLED,
    limits,
    usage: { chatMessages, activeMatters, generatedDocs },
  };
}

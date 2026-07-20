import type { Metadata } from "next";
import { BadgeCheck, Check } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isBillingConfigured } from "@/lib/billing/env";
import { effectiveTier, getSubscription } from "@/lib/billing/gate";
import {
  FREE_ACTIVE_MATTERS,
  FREE_CHAT_MESSAGES_PER_MONTH,
  FREE_GENERATED_DOCS_PER_MONTH,
  TIER_FEATURES,
  TIER_PRICING,
  tierLabel,
} from "@/lib/billing/tiers";
import {
  countActiveSelfMatters,
  countChatMessagesThisMonth,
  countGeneratedDocsThisMonth,
} from "@/lib/billing/usage";
import { PlanActions } from "@/components/billing/plan-actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Billing" };

/**
 * Plan & billing (Phase 10, Part 4.4). Consumers see Plus; lawyers see
 * Professional. Free consumers get live usage meters against this month's
 * allowances. All state changes flow through Stripe (checkout/portal) and
 * land via the webhook — this page only reads.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }, viewer] = await Promise.all([searchParams, getViewer()]);
  if (!viewer.user) return null; // (app) layout redirects

  const role = viewer.profile?.role ?? "consumer";
  const upgradeTier = role === "lawyer" ? "professional" : "plus";
  const pricing = TIER_PRICING[upgradeTier];

  const subscription = viewer.isDemo ? null : await getSubscription();
  const tier = viewer.isDemo ? "free" : effectiveTier(subscription);
  const onPaidPlan = tier !== "free";

  // Live usage for free consumers (demo shows illustrative numbers).
  let usage: { chat: number; matters: number; docs: number } | null = null;
  if (role === "consumer" && !onPaidPlan) {
    if (viewer.isDemo || !isSupabaseConfigured) {
      usage = { chat: 9, matters: 1, docs: 1 };
    } else {
      const supabase = await createClient();
      const [chat, matters, docs] = await Promise.all([
        countChatMessagesThisMonth(supabase, viewer.user.id),
        countActiveSelfMatters(supabase, viewer.user.id),
        countGeneratedDocsThisMonth(supabase, viewer.user.id),
      ]);
      usage = { chat, matters, docs };
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="animate-fade-in-up">
        <p className="text-sm text-muted">Plan &amp; billing</p>
        <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-foreground">
          Billing
        </h1>
      </header>

      {status === "success" && (
        <Alert tone="success" title="Welcome aboard">
          Your upgrade is processing — it takes effect the moment Stripe
          confirms payment (usually seconds). Refresh if you don&rsquo;t see
          it yet.
        </Alert>
      )}
      {status === "canceled" && (
        <Alert tone="info">
          Checkout was canceled — nothing was charged. Your plan is unchanged.
        </Alert>
      )}
      {!isBillingConfigured && (
        <Alert tone="info" title="Billing isn't connected yet">
          Plans are shown for preview. Payments activate once Stripe is
          configured for this deployment.
        </Alert>
      )}

      {/* Current plan */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Current plan
            </p>
            <p className="mt-1 flex items-center gap-2 font-serif text-2xl font-medium tracking-tight text-foreground">
              {tierLabel(tier)}
              {onPaidPlan && (
                <Badge tone="success">
                  <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                  Active
                </Badge>
              )}
            </p>
            {subscription?.renews_at && onPaidPlan && (
              <p className="mt-1 text-sm text-muted">
                Renews{" "}
                {new Date(subscription.renews_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
            {subscription?.status === "past_due" && (
              <p className="mt-1 text-sm font-medium text-alert">
                Payment issue — update your card to keep your plan.
              </p>
            )}
          </div>
          <PlanActions
            canUpgrade={!onPaidPlan && isBillingConfigured && !viewer.isDemo}
            canManage={Boolean(subscription?.stripe_customer_id)}
            upgradeLabel={`Upgrade to ${pricing.label} — ${pricing.price}${pricing.cadence}`}
          />
        </div>

        {usage && (
          <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
            <UsageMeter
              label="Assistant messages"
              used={usage.chat}
              limit={FREE_CHAT_MESSAGES_PER_MONTH}
              cadence="this month"
            />
            <UsageMeter
              label="Active matters"
              used={usage.matters}
              limit={FREE_ACTIVE_MATTERS}
              cadence="open now"
            />
            <UsageMeter
              label="Document drafts"
              used={usage.docs}
              limit={FREE_GENERATED_DOCS_PER_MONTH}
              cadence="this month"
            />
          </div>
        )}
      </Card>

      {/* Upgrade card */}
      {!onPaidPlan && (
        <Card raised className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">
              LexMind {pricing.label}
            </h2>
            <p className="text-lg font-semibold text-foreground">
              {pricing.price}
              <span className="text-sm font-normal text-muted">{pricing.cadence}</span>
            </p>
          </div>
          <ul className="mt-4 space-y-2">
            {TIER_FEATURES[upgradeTier].map((feature) => (
              <li key={feature} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Payments are handled by Stripe. Cancel anytime — your plan stays
            active until the period ends.
          </p>
        </Card>
      )}
    </div>
  );
}

function UsageMeter({
  label,
  used,
  limit,
  cadence,
}: {
  label: string;
  used: number;
  limit: number;
  cadence: string;
}) {
  const clamped = Math.min(used, limit);
  const pct = Math.round((clamped / limit) * 100);
  const atLimit = used >= limit;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-strong">{label}</p>
        <p className="text-xs tabular-nums text-muted">
          <span className={atLimit ? "font-semibold text-alert" : "font-semibold text-foreground"}>
            {used}
          </span>
          /{limit} {cadence}
        </p>
      </div>
      <div
        role="meter"
        aria-label={`${label}: ${used} of ${limit} ${cadence}`}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={limit}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={atLimit ? "h-full rounded-full bg-alert" : "h-full rounded-full bg-accent"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

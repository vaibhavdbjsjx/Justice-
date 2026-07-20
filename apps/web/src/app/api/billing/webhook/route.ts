import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  STRIPE_WEBHOOK_SECRET,
  isBillingConfigured,
  requireBillingEnv,
} from "@/lib/billing/env";
import {
  normalizeSubscriptionStatus,
  tierForPrice,
  verifyStripeSignature,
} from "@/lib/billing/stripe";

/**
 * Stripe webhook (Phase 10). The ONLY writer of subscription state — the
 * `subscriptions` table has no authenticated write policy, so tier changes
 * can come exclusively from here (service role), driven by verified events.
 *
 * Handled: checkout.session.completed (maps user via metadata),
 * customer.subscription.updated / .deleted (maps user via
 * stripe_customer_id). Everything else is acknowledged and ignored.
 */

type StripeEvent = {
  type?: string;
  data?: { object?: Record<string, unknown> };
};

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

export async function POST(request: Request): Promise<Response> {
  if (!isBillingConfigured || !STRIPE_WEBHOOK_SECRET || !isSupabaseConfigured) {
    return Response.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!verifyStripeSignature(payload, signature, STRIPE_WEBHOOK_SECRET)) {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return Response.json({ error: "Malformed payload." }, { status: 400 });
  }
  const object = event.data?.object ?? {};
  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const metadata = (object.metadata ?? {}) as Record<string, unknown>;
        const userId = str(metadata.user_id) ?? str(object.client_reference_id);
        const tier = str(metadata.tier);
        if (!userId || (tier !== "plus" && tier !== "professional")) break;

        const { error } = await admin.from("subscriptions").upsert(
          {
            user_id: userId,
            tier,
            status: "active",
            stripe_customer_id: str(object.customer),
            stripe_subscription_id: str(object.subscription),
          },
          { onConflict: "user_id" },
        );
        if (error) throw error;
        break;
      }

      case "customer.subscription.updated": {
        const customerId = str(object.customer);
        if (!customerId) break;

        const items = object.items as
          | { data?: { price?: { id?: string } }[] }
          | undefined;
        const priceId = items?.data?.[0]?.price?.id ?? null;
        const prices = requireBillingEnv();
        const tier = tierForPrice(priceId, prices);
        const status = normalizeSubscriptionStatus(str(object.status) ?? "");
        const periodEnd =
          typeof object.current_period_end === "number"
            ? new Date(object.current_period_end * 1000).toISOString()
            : null;

        const { error } = await admin
          .from("subscriptions")
          .update({
            ...(tier ? { tier } : {}),
            status,
            renews_at: periodEnd,
            stripe_subscription_id: str(object.id),
          })
          .eq("stripe_customer_id", customerId);
        if (error) throw error;
        break;
      }

      case "customer.subscription.deleted": {
        const customerId = str(object.customer);
        if (!customerId) break;
        const { error } = await admin
          .from("subscriptions")
          .update({
            tier: "free",
            status: "active",
            renews_at: null,
            stripe_subscription_id: null,
          })
          .eq("stripe_customer_id", customerId);
        if (error) throw error;
        break;
      }

      default:
        // Acknowledged, intentionally unhandled.
        break;
    }
  } catch (err) {
    console.error("[billing] webhook handling failed:", event.type, err);
    // Non-2xx makes Stripe retry — correct for transient DB failures.
    return Response.json({ error: "Handler failed." }, { status: 500 });
  }

  return Response.json({ received: true });
}

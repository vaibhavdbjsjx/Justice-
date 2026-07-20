import { getViewer } from "@/lib/auth/session";
import { isBillingConfigured, requireBillingEnv, APP_URL } from "@/lib/billing/env";
import { createCheckoutSession, StripeError } from "@/lib/billing/stripe";
import { getSubscription } from "@/lib/billing/gate";

/**
 * Starts a Stripe Checkout for the viewer's role-appropriate tier (Phase 10):
 * consumers → Plus, lawyers → Professional. Returns { url } to redirect to.
 */

const BILLING_UNAVAILABLE =
  "Billing isn't connected yet. Please try again later.";

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(): Promise<Response> {
  if (!isBillingConfigured) return jsonError(BILLING_UNAVAILABLE, 503);

  const viewer = await getViewer();
  if (!viewer.user || !viewer.profile) {
    return jsonError("Please sign in to manage your plan.", 401);
  }
  if (viewer.isDemo) return jsonError(BILLING_UNAVAILABLE, 503);

  const tier = viewer.profile.role === "lawyer" ? "professional" : "plus";
  const { pricePlus, priceProfessional } = requireBillingEnv();
  const subscription = await getSubscription();

  try {
    const session = await createCheckoutSession({
      price: tier === "professional" ? priceProfessional : pricePlus,
      userId: viewer.user.id,
      tier,
      customerEmail: viewer.user.email,
      existingCustomerId: subscription?.stripe_customer_id ?? null,
      successUrl: `${APP_URL}/billing?status=success`,
      cancelUrl: `${APP_URL}/billing?status=canceled`,
    });
    if (!session.url) return jsonError(BILLING_UNAVAILABLE, 502);
    return Response.json({ url: session.url });
  } catch (err) {
    if (err instanceof StripeError) {
      console.error("[billing] checkout failed:", err.status, err.detail);
    } else {
      console.error("[billing] unexpected error:", err);
    }
    return jsonError("That didn't go through. Please try again in a moment.", 502);
  }
}

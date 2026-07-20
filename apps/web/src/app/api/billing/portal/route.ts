import { getViewer } from "@/lib/auth/session";
import { isBillingConfigured, APP_URL } from "@/lib/billing/env";
import { createPortalSession, StripeError } from "@/lib/billing/stripe";
import { getSubscription } from "@/lib/billing/gate";

/** Opens the Stripe billing portal (manage / cancel / update card). */

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(): Promise<Response> {
  if (!isBillingConfigured) {
    return jsonError("Billing isn't connected yet. Please try again later.", 503);
  }

  const viewer = await getViewer();
  if (!viewer.user) return jsonError("Please sign in to manage your plan.", 401);
  if (viewer.isDemo) return jsonError("Billing isn't connected yet.", 503);

  const subscription = await getSubscription();
  if (!subscription?.stripe_customer_id) {
    return jsonError("There's no billing account to manage yet.", 400);
  }

  try {
    const session = await createPortalSession({
      customerId: subscription.stripe_customer_id,
      returnUrl: `${APP_URL}/billing`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    if (err instanceof StripeError) {
      console.error("[billing] portal failed:", err.status, err.detail);
    } else {
      console.error("[billing] unexpected error:", err);
    }
    return jsonError("That didn't go through. Please try again in a moment.", 502);
  }
}

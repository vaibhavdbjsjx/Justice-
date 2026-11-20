import { NextResponse } from "next/server";
import { createClient, bearerToken } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isBillingConfigured } from "@/lib/billing/env";
import { cancelSubscription } from "@/lib/billing/stripe";

/**
 * Permanent account deletion (App Store Guideline 5.1.1(v) — mandatory for any
 * app with account creation). The caller can only delete THEIR OWN account: we
 * resolve the user from their session/token, then use the service role to
 * remove the auth user. Every table references auth.users with ON DELETE
 * CASCADE, so profiles, matters, documents, chat, deadlines, and subscriptions
 * are all removed with it.
 *
 * A web subscription is cancelled first so a deleted account can't keep being
 * charged. Apple doesn't let servers cancel App Store subscriptions, so the
 * response tells the app to send the person to Apple's subscription settings.
 */
export async function POST() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Account management isn't available in preview mode." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const bearer = await bearerToken();
  const {
    data: { user },
  } = bearer ? await supabase.auth.getUser(bearer) : await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You're not signed in." }, { status: 401 });
  }

  let appleSubscription = false;
  try {
    const admin = createAdminClient();
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    appleSubscription = Boolean(subscription?.apple_original_transaction_id);
    if (subscription?.stripe_subscription_id && isBillingConfigured) {
      await cancelSubscription(subscription.stripe_subscription_id);
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (err) {
    console.error("[account] deletion failed:", err);
    return NextResponse.json(
      {
        error:
          "We couldn't delete your account just now. Please try again or contact support.",
      },
      { status: 500 },
    );
  }

  // Clear the local session cookies for web callers.
  try {
    await supabase.auth.signOut();
  } catch {
    // Non-fatal: the account is already gone.
  }

  return NextResponse.json({ ok: true, appleSubscription });
}

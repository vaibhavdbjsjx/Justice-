import { NextResponse } from "next/server";
import { createClient, bearerToken } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Permanent account deletion (App Store Guideline 5.1.1(v) — mandatory for any
 * app with account creation). The caller can only delete THEIR OWN account: we
 * resolve the user from their session/token, then use the service role to
 * remove the auth user. Every table references auth.users with ON DELETE
 * CASCADE, so profiles, matters, documents, chat, deadlines, and subscriptions
 * are all removed with it.
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

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch {
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

  return NextResponse.json({ ok: true });
}

import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, requireSupabaseEnv } from "@/lib/supabase/env";

/**
 * Sends a password reset email for web and mobile alike. It uses the implicit
 * flow because a person may open the email on a different device from the one
 * that asked, where a PKCE verifier wouldn't exist. The response never reveals
 * whether an account exists.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json(
      { error: "Password reset isn't available in this preview." },
      { status: 400 },
    );
  }

  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body.email === "string") email = body.email.trim();
  } catch {
    // Handled by the check below.
  }
  if (!email || !email.includes("@")) {
    return Response.json({ error: "Enter your email address." }, { status: 400 });
  }

  const { url, anonKey } = requireSupabaseEnv();
  const supabase = createClient(url, anonKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
  });
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) console.error("[auth] reset email failed:", error.message);

  return Response.json({ ok: true });
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { friendlyAuthError } from "@/lib/auth/errors";
import { Alert } from "@/components/ui/alert";

function AppleIcon() {
  return (
    <svg className="h-[18px] w-[18px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.05 12.9c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.16-3 .9-3.78.9-.78 0-1.98-.88-3.25-.86-1.67.03-3.21.97-4.07 2.47-1.73 3-.44 7.45 1.25 9.89.83 1.2 1.82 2.53 3.12 2.48 1.25-.05 1.72-.8 3.23-.8 1.5 0 1.93.8 3.25.78 1.34-.03 2.19-1.22 3.01-2.42.95-1.39 1.34-2.73 1.36-2.8-.03-.01-2.6-1-2.62-3.96ZM14.6 4.98c.69-.83 1.15-1.99 1.02-3.14-.99.04-2.19.66-2.9 1.49-.64.73-1.2 1.9-1.05 3.02 1.1.09 2.23-.56 2.93-1.37Z" />
    </svg>
  );
}

/**
 * Sign in with Apple (PKCE → /auth/callback). Apple is the only social provider
 * we offer — paired with email sign-in, this keeps the surface small and
 * satisfies App Store Guideline 4.8 without inviting extra review scrutiny.
 * Styled per Apple HIG: solid black button (inverts to white on dark).
 */
export function OAuthButtons({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Sign in with Apple isn't connected in this preview yet.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${window.location.origin}/auth/callback${
            next ? `?next=${encodeURIComponent(next)}` : ""
          }`,
        },
      });
      if (error) throw error;
      // On success the browser is redirected to Apple.
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : null));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-black text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
      >
        <AppleIcon />
        {busy ? "Connecting…" : "Continue with Apple"}
      </button>
    </div>
  );
}

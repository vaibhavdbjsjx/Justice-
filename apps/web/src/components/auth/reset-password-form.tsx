"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { friendlyAuthError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

type LinkState = "checking" | "ready" | "invalid";

/**
 * Finishes a reset from the emailed link. The link's tokens arrive in the URL
 * fragment, which the browser client won't read on its own because it's set up
 * for PKCE, so they're applied here and then cleared from the address bar.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function establish() {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.hash.slice(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      let valid = false;
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        valid = !sessionError;
        window.history.replaceState(null, "", window.location.pathname);
      } else {
        const { data } = await supabase.auth.getSession();
        valid = Boolean(data.session);
      }
      if (!cancelled) setLinkState(valid ? "ready" : "invalid");
    }
    void establish();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Please use at least 8 characters.");
      return;
    }
    setPending(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError(friendlyAuthError(updateError.message));
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (linkState === "checking") {
    return <p className="text-center text-sm text-muted">Checking your link…</p>;
  }
  if (linkState === "invalid") {
    return (
      <Alert tone="error" title="This link has expired">
        Reset links work once and expire after a short time.{" "}
        <a href="/forgot-password" className="font-medium text-accent underline underline-offset-4">
          Request a new link
        </a>
        .
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="New password" htmlFor="password" required hint="At least 8 characters.">
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}

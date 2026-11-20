"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Remembers "Not now" for a day, so declining doesn't trap someone in a loop. */
const DEFER_COOKIE = "lexa_ai_consent_deferred";

export function AiConsentForm({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agree() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/consent", { method: "POST" });
      if (!res.ok) throw new Error();
      window.location.assign(next);
    } catch {
      setError("We couldn't save that just now. Please try again.");
      setPending(false);
    }
  }

  function notNow() {
    document.cookie = `${DEFER_COOKIE}=1; path=/; max-age=86400; samesite=lax`;
    window.location.assign(next);
  }

  return (
    <div className="mt-6 space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      <Button size="lg" className="w-full" onClick={agree} disabled={pending}>
        {pending ? "Saving…" : "I agree"}
      </Button>
      <Button variant="ghost" size="lg" className="w-full" onClick={notNow} disabled={pending}>
        Not now
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted">
        Without this, the assistant and document tools stay off. Your matters and
        deadlines still work.
      </p>
    </div>
  );
}

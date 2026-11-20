"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** View or withdraw permission to share content with the AI provider. */
export function AiConsentSettings({
  granted,
  providerLabel,
}: {
  granted: boolean;
  providerLabel: string;
}) {
  const [isGranted, setGranted] = useState(granted);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/consent", { method: next ? "POST" : "DELETE" });
      if (!res.ok) throw new Error();
      setGranted(next);
    } catch {
      setError("We couldn't save that just now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h3 className="font-medium text-foreground">AI data sharing</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {isGranted
          ? `You've agreed to share your questions and documents with ${providerLabel} so Lexa can answer. Withdrawing turns off the assistant and document tools.`
          : `Off. The assistant and document tools need your permission to share content with ${providerLabel}.`}
      </p>
      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => change(!isGranted)}
        disabled={pending}
      >
        {isGranted ? "Withdraw permission" : "Give permission"}
      </Button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteMatter } from "@/lib/matters/actions";

/**
 * Two-step, explicit-confirmation delete (cascade removes chat, documents,
 * and deadlines — irreversible, so no single-click path).
 */
export function DeleteMatterButton({ matterId }: { matterId: string }) {
  const [arming, setArming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!arming) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setArming(true)}>
        Delete this matter…
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-alert/30 bg-alert-soft p-4">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden="true" />
        This permanently deletes the matter, its conversation, documents, and
        deadlines. This cannot be undone.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex items-center gap-3">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await deleteMatter(matterId);
              if (result?.error) setError(result.error);
            });
          }}
        >
          {pending ? "Deleting…" : "Yes, delete permanently"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setArming(false)}
        >
          Keep the matter
        </Button>
      </div>
    </div>
  );
}

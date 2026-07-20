"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteDocument } from "@/lib/documents/actions";

/** Two-step delete for an analyzed document (analysis is not recoverable). */
export function DeleteDocumentButton({
  documentId,
  matterId,
}: {
  documentId: string;
  matterId: string;
}) {
  const [arming, setArming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!arming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setArming(true)}
        aria-label="Delete this document"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Delete
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await deleteDocument(documentId, matterId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "Deleting…" : "Delete permanently"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setArming(false)}
      >
        Keep it
      </Button>
    </div>
  );
}

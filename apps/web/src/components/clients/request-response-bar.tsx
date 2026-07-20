"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, UserRoundPlus, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { respondToClientRequest } from "@/lib/clients/actions";

/**
 * Pending-request bar on the lawyer case view (Phase 9). Declining ends the
 * link and drops access to the matter entirely, so it asks once.
 */
export function RequestResponseBar({
  matterId,
  clientId,
  clientName,
  isDemo,
}: {
  matterId: string;
  clientId: string;
  clientName: string;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"active" | "ended" | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = async (response: "active" | "ended") => {
    if (busy) return;
    setError(null);
    if (isDemo) {
      setError("Local preview — responses aren't saved.");
      return;
    }
    setBusy(response);
    const result = await respondToClientRequest(matterId, clientId, response);
    setBusy(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (response === "ended") router.push("/clients");
  };

  return (
    <Card className="border-l-2 border-l-accent p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
          <UserRoundPlus className="h-4 w-4 text-accent" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {clientName} has asked to work with you
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Review the brief and thread below. Accepting keeps the matter in
            your list; declining removes your access to it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {confirmDecline ? (
            <>
              <span className="text-xs font-medium text-muted">Decline?</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => respond("ended")}
                disabled={busy !== null}
              >
                {busy === "ended" ? "Declining…" : "Yes, decline"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDecline(false)}
                disabled={busy !== null}
              >
                Keep reviewing
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => respond("active")}
                disabled={busy !== null}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {busy === "active" ? "Accepting…" : "Accept"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDecline(true)}
                disabled={busy !== null}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Decline
              </Button>
            </>
          )}
        </div>
      </div>
      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}
    </Card>
  );
}

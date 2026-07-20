"use client";

import { useState } from "react";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Checkout + portal buttons (Phase 10): POST, then follow Stripe's URL. */
export function PlanActions({
  canUpgrade,
  canManage,
  upgradeLabel,
}: {
  canUpgrade: boolean;
  canManage: boolean;
  upgradeLabel: string;
}) {
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (endpoint: "checkout" | "portal") => {
    if (busy) return;
    setError(null);
    setBusy(endpoint);
    try {
      const res = await fetch(`/api/billing/${endpoint}`, { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "That didn't go through. Please try again.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("That didn't go through. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-2.5">
        {canUpgrade && (
          <Button onClick={() => go("checkout")} disabled={busy !== null}>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            {busy === "checkout" ? "Opening secure checkout…" : upgradeLabel}
          </Button>
        )}
        {canManage && (
          <Button
            variant="secondary"
            onClick={() => go("portal")}
            disabled={busy !== null}
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            {busy === "portal" ? "Opening…" : "Manage subscription"}
          </Button>
        )}
      </div>
    </div>
  );
}

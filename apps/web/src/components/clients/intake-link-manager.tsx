"use client";

import { useState } from "react";
import { Check, Copy, Link2, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createIntakeLink, revokeIntakeLink } from "@/lib/clients/actions";
import type { IntakeLink } from "@/lib/supabase/types";

/**
 * Intake-link management (Phase 8): create labeled links, copy the branded
 * URL, revoke. Tokens stay boring here — the URL is the product.
 */
export function IntakeLinkManager({ links }: { links: IntakeLink[] }) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const result = await createIntakeLink(label);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setLabel("");
  };

  const revoke = async (id: string) => {
    setError(null);
    const result = await revokeIntakeLink(id);
    if (result?.error) setError(result.error);
  };

  const copy = async (link: IntakeLink) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/intake/${link.token}`,
      );
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError("Couldn't copy — your browser blocked clipboard access.");
    }
  };

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}

      {links.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-muted">
            Create your first intake link and put it anywhere clients find you
            — your website, email signature, referral partners. Anyone who
            opens it can send you their situation as a structured case brief.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                  <Link2 className="h-4 w-4 text-accent" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {link.label || "Intake link"}
                  </p>
                  <p className="truncate font-mono text-xs text-muted">
                    /intake/{link.token.slice(0, 12)}…
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copy(link)}
                  >
                    {copiedId === link.id ? (
                      <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copiedId === link.id ? "Copied" : "Copy link"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Revoke ${link.label || "intake link"}`}
                    onClick={() => revoke(link.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={create} className="flex flex-wrap items-center gap-2">
        <label htmlFor="intake-link-label" className="sr-only">
          Label for the new intake link
        </label>
        <Input
          id="intake-link-label"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 80))}
          placeholder='Label (e.g. "Website", "Referrals") — optional'
          className="w-64 max-w-full"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={busy}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {busy ? "Creating…" : "New intake link"}
        </Button>
      </form>
    </div>
  );
}

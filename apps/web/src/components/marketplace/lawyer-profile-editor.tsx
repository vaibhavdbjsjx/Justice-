"use client";

import { useState } from "react";
import { Check, Plus, Save, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LawyerCard } from "./lawyer-card";
import { updateLawyerProfile } from "@/lib/lawyers/actions";
import { PRACTICE_AREAS } from "@/lib/legal/practice-areas";
import type { MarketplaceLawyer } from "@/lib/lawyers/queries";
import { cn } from "@/lib/utils";

/**
 * Marketplace profile editor (Phase 9) with a live preview of exactly the
 * card consumers will see. Verification status is shown by the parent page —
 * it is not editable here (or anywhere client-side; column grants).
 */
export function LawyerProfileEditor({
  initial,
  viewerName,
  verified,
}: {
  initial: {
    bio: string;
    practiceAreas: string[];
    licensedJurisdictions: string[];
    barNumber: string;
    rateRange: string;
  };
  viewerName: string;
  verified: boolean;
}) {
  const [bio, setBio] = useState(initial.bio);
  const [areas, setAreas] = useState<string[]>(initial.practiceAreas);
  const [jurisdictions, setJurisdictions] = useState<string[]>(
    initial.licensedJurisdictions,
  );
  const [newJurisdiction, setNewJurisdiction] = useState("");
  const [barNumber, setBarNumber] = useState(initial.barNumber);
  const [rateRange, setRateRange] = useState(initial.rateRange);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleArea = (area: string) =>
    setAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );

  const addJurisdiction = () => {
    const j = newJurisdiction.trim();
    if (!j || jurisdictions.includes(j) || jurisdictions.length >= 8) return;
    setJurisdictions((prev) => [...prev, j]);
    setNewJurisdiction("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setSaved(false);
    setBusy(true);
    const result = await updateLawyerProfile({
      bio,
      practiceAreas: areas,
      licensedJurisdictions: jurisdictions,
      barNumber,
      rateRange,
    });
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };

  const preview: MarketplaceLawyer = {
    userId: "preview",
    name: viewerName,
    verified,
    practiceAreas: areas,
    licensedJurisdictions: jurisdictions,
    rateRange: rateRange.trim() || null,
    ratingAvg: null,
    bio: bio.trim() || null,
    country: null,
    state: null,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={save} className="min-w-0 space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <Field
          label="Bio"
          htmlFor="mp-bio"
          hint="What you handle, how you work, what a first consultation looks like. Honest beats impressive."
        >
          <Textarea
            id="mp-bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 800))}
            placeholder="Fifteen years helping tenants and small businesses…"
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">
            Practice areas
          </legend>
          <div className="flex flex-wrap gap-2">
            {PRACTICE_AREAS.map((area) => {
              const active = areas.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                    active
                      ? "border-accent bg-accent-soft text-foreground"
                      : "border-border bg-surface text-muted hover:border-accent hover:text-foreground",
                  )}
                >
                  {active && <Check className="h-3 w-3 text-accent" aria-hidden="true" />}
                  {area}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field
          label="Licensed jurisdictions"
          htmlFor="mp-jurisdiction"
          hint='Add each as you want it displayed, e.g. "California, United States".'
        >
          <div className="space-y-2">
            {jurisdictions.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {jurisdictions.map((j) => (
                  <li
                    key={j}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    {j}
                    <button
                      type="button"
                      aria-label={`Remove ${j}`}
                      onClick={() =>
                        setJurisdictions((prev) => prev.filter((x) => x !== j))
                      }
                      className="text-muted transition-colors hover:text-alert"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                id="mp-jurisdiction"
                value={newJurisdiction}
                onChange={(e) => setNewJurisdiction(e.target.value.slice(0, 120))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addJurisdiction();
                  }
                }}
                placeholder="California, United States"
                className="max-w-xs"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addJurisdiction}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </Button>
            </div>
          </div>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Bar / enrollment number"
            htmlFor="mp-bar"
            hint="Used for verification; not shown publicly."
          >
            <Input
              id="mp-bar"
              value={barNumber}
              onChange={(e) => setBarNumber(e.target.value.slice(0, 80))}
              placeholder="CA-123456"
            />
          </Field>
          <Field label="Rate range" htmlFor="mp-rate" hint="Shown on your card.">
            <Input
              id="mp-rate"
              value={rateRange}
              onChange={(e) => setRateRange(e.target.value.slice(0, 80))}
              placeholder="$200–300/hr"
            />
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {busy ? "Saving…" : "Save profile"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-success">
              <Check className="h-4 w-4" aria-hidden="true" />
              Saved
            </span>
          )}
        </div>
      </form>

      <aside aria-label="How consumers see you" className="lg:sticky lg:top-24 lg:self-start">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          How consumers see you
        </h2>
        <LawyerCard lawyer={preview} />
        {!verified && (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Your card appears in the directory once verification completes.
          </p>
        )}
      </aside>
    </div>
  );
}

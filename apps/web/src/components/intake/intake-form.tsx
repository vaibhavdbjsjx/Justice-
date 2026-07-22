"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, CheckCircle2, Loader2, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MATTER_CATEGORIES } from "@/lib/matters/categories";
import { COUNTRIES, getCountry, getSubdivisions, subdivisionLabel } from "@/lib/legal/countries";
import type { IntakeSubmitResponse, IntakeUrgency } from "@/lib/intake/types";
import { AI_ERROR_RETRY } from "@/lib/ai/copy";
import { cn } from "@/lib/utils";

/**
 * Guided intake form (Phase 8). Plain-language questions in; the lawyer gets
 * a structured brief out. Unauthenticated visitors keep their answers: the
 * form stashes to sessionStorage, routes through sign-up (?next back here),
 * and restores on return.
 */

const STASH_PREFIX = "justice:intake:";
const MAX_SITUATION_CHARS = 8_000;
const MAX_SHORT_CHARS = 2_000;

type FormState = {
  situation: string;
  category: string;
  countryCode: string;
  region: string;
  urgency: IntakeUrgency;
  key_dates: string;
  desired_outcome: string;
};

const EMPTY: FormState = {
  situation: "",
  category: "",
  countryCode: "",
  region: "",
  urgency: "not_urgent",
  key_dates: "",
  desired_outcome: "",
};

const URGENCY_OPTIONS: { value: IntakeUrgency; label: string; hint: string }[] = [
  { value: "not_urgent", label: "Not urgent", hint: "No deadline that I know of" },
  { value: "soon", label: "Needs attention soon", hint: "Weeks, not months" },
  { value: "urgent", label: "Urgent", hint: "A deadline or hearing is imminent" },
];

const STAGES = [
  "Reading your answers…",
  "Organizing the facts and timeline…",
  "Preparing a brief for the lawyer…",
];

export function IntakeForm({
  token,
  lawyerName,
  authed,
  isDemo,
}: {
  token: string;
  lawyerName: string;
  authed: boolean;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeSubmitResponse | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Restore a stash left before the sign-up round-trip (one-shot, on first
  // commit — callback ref, not an effect, for hydration safety).
  const restored = useRef(false);
  const restoreStash = useCallback(
    (node: HTMLFormElement | null) => {
      if (!node || restored.current) return;
      restored.current = true;
      try {
        const raw = sessionStorage.getItem(STASH_PREFIX + token);
        if (!raw) return;
        sessionStorage.removeItem(STASH_PREFIX + token);
        const parsed = JSON.parse(raw) as Partial<FormState>;
        setForm({ ...EMPTY, ...parsed });
      } catch {
        // Corrupt/unavailable storage — start fresh.
      }
    },
    [token],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !form.situation.trim()) return;

    if (!authed) {
      try {
        sessionStorage.setItem(STASH_PREFIX + token, JSON.stringify(form));
      } catch {
        // If storage fails they'll retype — still route them to sign-up.
      }
      router.push(`/sign-up?next=${encodeURIComponent(`/intake/${token}`)}`);
      return;
    }

    setError(null);
    setStage(0);
    setBusy(true);
    stageTimer.current = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      2400,
    );
    try {
      const country = getCountry(form.countryCode)?.name ?? null;
      const res = await fetch("/api/intake/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          situation: form.situation,
          category: form.category || "other",
          country,
          state: form.region || null,
          urgency: form.urgency,
          key_dates: form.key_dates,
          desired_outcome: form.desired_outcome,
        }),
      });
      if (!res.ok) {
        let message = AI_ERROR_RETRY;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // keep calm default
        }
        setError(message);
        return;
      }
      setResult((await res.json()) as IntakeSubmitResponse);
    } catch {
      setError(AI_ERROR_RETRY);
    } finally {
      if (stageTimer.current) clearInterval(stageTimer.current);
      setBusy(false);
    }
  };

  // ---- Sent ------------------------------------------------------------------
  if (result) {
    return (
      <Card raised className="p-6 text-center sm:p-8 animate-fade-in-up">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft">
          <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-serif text-2xl font-medium tracking-tight text-foreground">
          Sent to {lawyerName}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Your situation was organized into a case brief so {lawyerName} can
          review it quickly. They&rsquo;ll reach out through Justice — you can
          message each other from your matter.
        </p>
        <Card className="mt-5 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            What you sent
          </p>
          <p className="mt-1.5 font-medium text-foreground">{result.brief.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {result.brief.summary}
          </p>
        </Card>
        {result.matterId ? (
          <Button
            className="mt-5"
            onClick={() => router.push(`/matters/${result.matterId}`)}
          >
            Open your matter
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          isDemo && (
            <p className="mt-5 text-xs text-muted">
              Local preview — nothing was saved. Connect Supabase to keep
              intake submissions.
            </p>
          )
        )}
      </Card>
    );
  }

  // ---- Progress ----------------------------------------------------------------
  if (busy) {
    return (
      <Card raised className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center" role="status">
        <Loader2 className="h-7 w-7 animate-spin text-accent" aria-hidden="true" />
        <p className="mt-5 font-medium text-foreground">{STAGES[stage]}</p>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
          Only what you wrote goes into the brief — nothing is added or
          assumed.
        </p>
      </Card>
    );
  }

  const subdivisions = getSubdivisions(form.countryCode);
  const regionLabel = subdivisionLabel(form.countryCode);

  return (
    <form ref={restoreStash} onSubmit={submit} className="space-y-5" noValidate>
      {error && (
        <Alert tone="error" title="Something went wrong">
          {error}
        </Alert>
      )}

      <Field
        label="What's going on?"
        htmlFor="intake-situation"
        required
        hint="Plain language is perfect — what happened, who's involved, and where things stand."
      >
        <Textarea
          id="intake-situation"
          required
          rows={7}
          value={form.situation}
          onChange={(e) => set("situation", e.target.value.slice(0, MAX_SITUATION_CHARS))}
          placeholder="Start from the beginning: what happened, and what's happened since…"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="What kind of issue is it?" htmlFor="intake-category">
          <Select
            id="intake-category"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">Not sure — let the lawyer decide</option>
            {MATTER_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="How urgent is it?" htmlFor="intake-urgency">
          <Select
            id="intake-urgency"
            value={form.urgency}
            onChange={(e) => set("urgency", e.target.value as IntakeUrgency)}
          >
            {URGENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.hint}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Country" htmlFor="intake-country">
          <Select
            id="intake-country"
            value={form.countryCode}
            onChange={(e) => {
              set("countryCode", e.target.value);
              set("region", "");
            }}
          >
            <option value="">Select your country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={regionLabel} htmlFor="intake-region">
          {subdivisions.length > 0 ? (
            <Select
              id="intake-region"
              value={form.region}
              onChange={(e) => set("region", e.target.value)}
            >
              <option value="">Select {regionLabel.toLowerCase()}</option>
              {subdivisions.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="intake-region"
              value={form.region}
              onChange={(e) => set("region", e.target.value.slice(0, 120))}
              placeholder="Region (optional)"
            />
          )}
        </Field>
      </div>

      <Field
        label="Any dates or deadlines?"
        htmlFor="intake-dates"
        hint="Hearings, notices, dates something happened — as best you remember."
      >
        <div className="relative">
          <CalendarClock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            id="intake-dates"
            className="pl-9"
            value={form.key_dates}
            onChange={(e) => set("key_dates", e.target.value.slice(0, MAX_SHORT_CHARS))}
            placeholder='e.g. "Hearing on July 14" or "Notice arrived about two weeks ago"'
          />
        </div>
      </Field>

      <Field label="What would you like to happen?" htmlFor="intake-outcome">
        <Textarea
          id="intake-outcome"
          rows={3}
          value={form.desired_outcome}
          onChange={(e) => set("desired_outcome", e.target.value.slice(0, MAX_SHORT_CHARS))}
          placeholder="The outcome you're hoping for, in your own words…"
        />
      </Field>

      <div className={cn("flex flex-wrap items-center gap-4")}>
        <Button type="submit" size="lg" disabled={!form.situation.trim()}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {authed ? `Send to ${lawyerName}` : "Continue — create a free account"}
        </Button>
        {!authed && (
          <p className="text-xs leading-relaxed text-muted">
            Your answers are kept on this device while you create an account.
          </p>
        )}
      </div>
    </form>
  );
}

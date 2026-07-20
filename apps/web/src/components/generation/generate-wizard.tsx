"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, PenLine } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GeneratedDocView } from "@/components/documents/generated-doc-view";
import type { MatterOption } from "@/components/documents/upload-analyze";
import { DOC_TEMPLATES, type DocTemplate } from "@/lib/generation/templates";
import type { GenerateResponse } from "@/lib/generation/types";
import { AI_ERROR_RETRY } from "@/lib/ai/copy";
import { cn } from "@/lib/utils";

/**
 * Generation wizard (Phase 6): pick a document type → answer a short intake →
 * draft. Persisted drafts route to /documents/[id]; local preview renders
 * the result inline.
 */

const STAGES = [
  "Reviewing your details…",
  "Drafting the document…",
  "Checking judgment calls and placeholders…",
];

export function GenerateWizard({
  matters,
  preselectedMatterId,
}: {
  matters: MatterOption[];
  preselectedMatterId?: string;
}) {
  const router = useRouter();
  const [template, setTemplate] = useState<DocTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [matterId, setMatterId] = useState(preselectedMatterId ?? "");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      2600,
    );
    return () => clearInterval(timer);
  }, [busy]);

  const generate = async () => {
    if (!template || busy) return;
    setError(null);
    setStage(0);
    setBusy(true);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: template.slug,
          answers,
          matterId: matterId || undefined,
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
      const data = (await res.json()) as GenerateResponse;
      if (data.documentId) {
        router.push(`/documents/${data.documentId}`);
        return;
      }
      setResult(data);
    } catch {
      setError(AI_ERROR_RETRY);
    } finally {
      setBusy(false);
    }
  };

  // ---- Result (local preview) ----------------------------------------------
  if (result) {
    return (
      <div className="space-y-5">
        <Alert tone="info" title={result.generated.title}>
          Draft ready. In this local preview the document isn&apos;t saved —
          connect Supabase to keep your drafts.
        </Alert>
        <GeneratedDocView generated={result.generated} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setResult(null);
            setTemplate(null);
            setAnswers({});
          }}
        >
          Draft another document
        </Button>
      </div>
    );
  }

  // ---- Progress --------------------------------------------------------------
  if (busy) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center rounded-xl border border-border bg-surface px-6 py-14 text-center shadow-[var(--shadow-sm)]"
      >
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
          <PenLine className="h-6 w-6 text-accent" aria-hidden="true" />
          <Loader2
            className="absolute -bottom-1.5 -right-1.5 h-5 w-5 text-accent motion-safe:animate-spin"
            aria-hidden="true"
          />
        </span>
        <p className="mt-5 font-serif text-xl font-medium tracking-tight text-foreground">
          {STAGES[stage]}
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Only the facts you provided go in — anything unknown becomes a
          placeholder for you to fill.
        </p>
      </div>
    );
  }

  // ---- Step 1: template picker ------------------------------------------------
  if (!template) {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {DOC_TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => setTemplate(t)}
              className={cn(
                "group flex items-start gap-3.5 rounded-xl border border-border bg-surface p-4 text-left shadow-[var(--shadow-sm)]",
                "transition-colors duration-150 hover:border-accent hover:bg-accent-soft",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-medium text-foreground">
                  {t.name}
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                  {t.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // ---- Step 2: intake ----------------------------------------------------------
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void generate();
      }}
      className="space-y-5"
      noValidate
    >
      <button
        type="button"
        onClick={() => setTemplate(null)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All document types
      </button>

      <div>
        <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          {template.name}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {template.description}
        </p>
      </div>

      {template.fields.map((f) => (
        <Field
          key={f.name}
          label={f.label}
          htmlFor={`gen-${f.name}`}
          required={f.required}
          hint={f.hint}
        >
          {f.kind === "textarea" ? (
            <Textarea
              id={`gen-${f.name}`}
              value={answers[f.name] ?? ""}
              rows={4}
              maxLength={4000}
              placeholder={f.placeholder}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [f.name]: e.target.value }))
              }
            />
          ) : (
            <Input
              id={`gen-${f.name}`}
              type={f.kind === "date" ? "date" : "text"}
              value={answers[f.name] ?? ""}
              maxLength={300}
              placeholder={f.placeholder}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [f.name]: e.target.value }))
              }
            />
          )}
        </Field>
      ))}

      <Field
        label="Matter"
        htmlFor="gen-matter"
        hint="The draft is saved to this matter; its jurisdiction and analyzed documents inform the draft."
      >
        <Select
          id="gen-matter"
          value={matterId}
          onChange={(e) => setMatterId(e.target.value)}
        >
          <option value="">General consultation</option>
          {matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </Select>
      </Field>

      {error && <Alert tone="error">{error}</Alert>}

      <Button
        type="submit"
        disabled={
          busy ||
          template.fields.some((f) => f.required && !(answers[f.name] ?? "").trim())
        }
      >
        <PenLine className="h-4 w-4" aria-hidden="true" />
        Draft this document
      </Button>
    </form>
  );
}

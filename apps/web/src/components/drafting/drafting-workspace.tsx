"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  BookOpen,
  FileSignature,
  Gavel,
  GitCompareArrows,
  Loader2,
  Mail,
  PenLine,
  Stamp,
  TextQuote,
  type LucideIcon,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { GeneratedDocView } from "@/components/documents/generated-doc-view";
import { RedlineDocView } from "@/components/documents/redline-doc-view";
import { LAWYER_DOC_TYPES, type LawyerDocType } from "@/lib/drafting/doc-types";
import type {
  LawyerDraftResponse,
  RedlineResponse,
} from "@/lib/drafting/types";
import { takeDraftingPrefill } from "@/lib/drafting/prefill";
import { AI_ERROR_RETRY } from "@/lib/ai/copy";
import { cn } from "@/lib/utils";

/**
 * Lawyer drafting workspace (Phase 7, Part 4.3): free-form drafting and
 * redlining. Persisted results route to /documents/[id]; local preview
 * renders inline (matching the Phase 6 wizard behavior). A research answer
 * can arrive as prefill via the "Use in drafting" bridge.
 */

type Mode = "draft" | "redline";

const MAX_INSTRUCTIONS_CHARS = 12_000;
const MAX_REDLINE_INSTRUCTIONS_CHARS = 8_000;
const MAX_ORIGINAL_CHARS = 24_000;

const DOC_TYPE_ICONS: Record<string, LucideIcon> = {
  contract: FileSignature,
  clause: TextQuote,
  motion: Gavel,
  memo: BookOpen,
  letter: Mail,
  affidavit: Stamp,
  notice: BellRing,
  custom: PenLine,
};

const DRAFT_STAGES = [
  "Reading your instructions…",
  "Drafting the instrument…",
  "Flagging judgment calls…",
];
const REDLINE_STAGES = [
  "Reading the original…",
  "Applying your instructions…",
  "Writing the change log…",
];

export function DraftingWorkspace({ initialMode }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode ?? "draft");

  // Draft mode
  const [docType, setDocType] = useState<LawyerDocType | null>(null);
  const [instructions, setInstructions] = useState("");

  // Redline mode
  const [original, setOriginal] = useState("");
  const [redlineInstructions, setRedlineInstructions] = useState("");

  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draftResult, setDraftResult] = useState<LawyerDraftResponse | null>(null);
  const [redlineResult, setRedlineResult] = useState<RedlineResponse | null>(null);

  const instructionsRef = useRef<HTMLTextAreaElement | null>(null);

  // Research → drafting bridge: consume the hand-off on first commit. A
  // callback ref (not an effect) — this is a one-shot apply of navigation
  // state, hydration-safe because it runs only after the client committed.
  const prefillConsumed = useRef(false);
  const consumePrefill = useCallback((node: HTMLDivElement | null) => {
    if (!node || prefillConsumed.current) return;
    prefillConsumed.current = true;
    const prefill = takeDraftingPrefill();
    if (!prefill) return;
    setMode("draft");
    setDocType(LAWYER_DOC_TYPES.find((t) => t.slug === "custom") ?? null);
    setInstructions(
      `Context from research:\n"""\n${prefill.context}\n"""\n\nDraft: `,
    );
    // Land the cursor after "Draft: " so the lawyer completes the sentence.
    requestAnimationFrame(() => {
      const el = instructionsRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }, []);

  useEffect(() => {
    if (!busy) return;
    const stages = mode === "draft" ? DRAFT_STAGES : REDLINE_STAGES;
    const timer = setInterval(
      () => setStage((s) => Math.min(s + 1, stages.length - 1)),
      2600,
    );
    return () => clearInterval(timer);
  }, [busy, mode]);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setStage(0);
    setBusy(true);
    try {
      const endpoint =
        mode === "draft" ? "/api/drafting/draft" : "/api/drafting/redline";
      const payload =
        mode === "draft"
          ? { docType: docType?.slug, instructions }
          : { original, instructions: redlineInstructions };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

      if (mode === "draft") {
        const data = (await res.json()) as LawyerDraftResponse;
        if (data.documentId) {
          router.push(`/documents/${data.documentId}`);
          return;
        }
        setDraftResult(data);
      } else {
        const data = (await res.json()) as RedlineResponse;
        if (data.documentId) {
          router.push(`/documents/${data.documentId}`);
          return;
        }
        setRedlineResult(data);
      }
    } catch {
      setError(AI_ERROR_RETRY);
    } finally {
      setBusy(false);
    }
  };

  // ---- Results (local preview — persisted results navigate away) ------------
  if (draftResult) {
    return (
      <div className="space-y-5">
        <Alert tone="info" title={draftResult.generated.title}>
          Draft ready. In this local preview the document isn&apos;t saved —
          connect Supabase to keep your drafts.
        </Alert>
        <GeneratedDocView generated={draftResult.generated} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setDraftResult(null);
            setDocType(null);
            setInstructions("");
          }}
        >
          Start another draft
        </Button>
      </div>
    );
  }
  if (redlineResult) {
    return (
      <div className="space-y-5">
        <RedlineDocView redline={redlineResult.redline} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setRedlineResult(null);
            setOriginal("");
            setRedlineInstructions("");
          }}
        >
          Redline another document
        </Button>
      </div>
    );
  }

  // ---- Progress ---------------------------------------------------------------
  if (busy) {
    const stages = mode === "draft" ? DRAFT_STAGES : REDLINE_STAGES;
    return (
      <div
        className="flex min-h-[320px] flex-col items-center justify-center text-center"
        role="status"
      >
        <Loader2 className="h-7 w-7 animate-spin text-accent" aria-hidden="true" />
        <p className="mt-5 font-medium text-foreground">{stages[stage]}</p>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
          {mode === "draft"
            ? "Nothing is invented: missing facts become placeholders, and every judgment call is flagged for you."
            : "Every meaningful edit is logged with its rationale — nothing moves silently."}
        </p>
      </div>
    );
  }

  const canSubmit =
    mode === "draft"
      ? Boolean(docType && instructions.trim())
      : Boolean(original.trim());

  return (
    <div ref={consumePrefill} className="space-y-6">
      {/* Mode switch */}
      <div
        role="group"
        aria-label="Drafting mode"
        className="inline-flex rounded-lg border border-border bg-surface p-1"
      >
        <ModeButton
          active={mode === "draft"}
          onClick={() => setMode("draft")}
          icon={PenLine}
          label="New draft"
        />
        <ModeButton
          active={mode === "redline"}
          onClick={() => setMode("redline")}
          icon={GitCompareArrows}
          label="Redline"
        />
      </div>

      {error && (
        <Alert tone="error" title="Something went wrong">
          {error}
        </Alert>
      )}

      {mode === "draft" ? (
        <>
          {/* Document type */}
          <fieldset>
            <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              What are you drafting?
            </legend>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {LAWYER_DOC_TYPES.map((t) => {
                const Icon = DOC_TYPE_ICONS[t.slug] ?? PenLine;
                const selected = docType?.slug === t.slug;
                return (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => setDocType(t)}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-full flex-col rounded-xl border p-3.5 text-left transition-colors duration-150",
                      selected
                        ? "border-accent bg-accent-soft"
                        : "border-border bg-surface hover:border-accent",
                    )}
                  >
                    <Icon
                      className="h-4.5 w-4.5 text-accent"
                      aria-hidden="true"
                    />
                    <span className="mt-2 text-sm font-medium text-foreground">
                      {t.name}
                    </span>
                    <span className="mt-0.5 text-xs leading-relaxed text-muted">
                      {t.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Field
            label="Instructions"
            htmlFor="draft-instructions"
            hint={
              docType
                ? undefined
                : "Choose a document type above, then describe what you need."
            }
          >
            <Textarea
              id="draft-instructions"
              ref={instructionsRef}
              value={instructions}
              onChange={(e) =>
                setInstructions(e.target.value.slice(0, MAX_INSTRUCTIONS_CHARS))
              }
              rows={7}
              placeholder={
                docType?.inputHint ??
                "Describe the document: parties, key terms, posture, and the positions to take…"
              }
            />
          </Field>

          <div className="flex items-center gap-4">
            <Button onClick={submit} disabled={!canSubmit}>
              <PenLine className="h-4 w-4" aria-hidden="true" />
              Draft it
            </Button>
            <p className="text-xs leading-relaxed text-muted">
              Missing facts become [PLACEHOLDERS]; judgment calls are flagged.
            </p>
          </div>
        </>
      ) : (
        <>
          <Field label="Original text" htmlFor="redline-original">
            <Textarea
              id="redline-original"
              value={original}
              onChange={(e) =>
                setOriginal(e.target.value.slice(0, MAX_ORIGINAL_CHARS))
              }
              rows={12}
              placeholder="Paste the clause, agreement, or letter to revise…"
            />
          </Field>
          <p
            className={cn(
              "-mt-4 text-right text-xs tabular-nums",
              original.length >= MAX_ORIGINAL_CHARS
                ? "text-alert"
                : "text-muted",
            )}
          >
            {original.length.toLocaleString()} /{" "}
            {MAX_ORIGINAL_CHARS.toLocaleString()}
          </p>

          <Field
            label="Instructions"
            htmlFor="redline-instructions"
            hint="Optional — leave blank for a general pass over clarity, consistency, and risk."
          >
            <Textarea
              id="redline-instructions"
              value={redlineInstructions}
              onChange={(e) =>
                setRedlineInstructions(
                  e.target.value.slice(0, MAX_REDLINE_INSTRUCTIONS_CHARS),
                )
              }
              rows={4}
              placeholder="e.g. Make the indemnity mutual, cap liability at fees paid in the trailing 12 months, and tighten the termination triggers…"
            />
          </Field>

          <div className="flex items-center gap-4">
            <Button onClick={submit} disabled={!canSubmit}>
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
              Redline it
            </Button>
            <p className="text-xs leading-relaxed text-muted">
              You&apos;ll get the full revised text and a change log with
              rationale.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
        active
          ? "bg-primary text-primary-foreground shadow-[var(--shadow-sm)]"
          : "text-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

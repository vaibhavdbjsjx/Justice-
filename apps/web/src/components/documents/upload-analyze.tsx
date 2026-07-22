"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileUp, Loader2, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnalysisView } from "./analysis-view";
import { DOC_FILE_INVALID } from "@/lib/ai/copy";
import type { AnalyzeResponse } from "@/lib/documents/analysis-types";
import { cn } from "@/lib/utils";

/**
 * Upload → analyze flow with the engaging staged progress state Part 10 asks
 * for. On success: persisted documents route to /documents/[id]; in local
 * preview (nothing persisted) the analysis renders right here.
 */

export type MatterOption = {
  id: string;
  title: string;
  country: string | null;
  state: string | null;
};

const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/** Staged copy while the single analysis call runs (~time-based). */
const STAGES = [
  "Reading the document…",
  "Extracting the text…",
  "Identifying obligations and deadlines…",
  "Checking for risky or unusual clauses…",
  "Preparing plain-language explanations…",
];

export function UploadAnalyze({
  matters,
  preselectedMatterId,
  viewerJurisdiction,
  isDemo,
}: {
  matters: MatterOption[];
  preselectedMatterId?: string;
  viewerJurisdiction: { country: string | null; state: string | null };
  isDemo: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [matterId, setMatterId] = useState(preselectedMatterId ?? "");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  // Advance the staged copy while the request is in flight.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      2200,
    );
    return () => clearInterval(timer);
  }, [busy]);

  const pick = useCallback((f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    if (!ACCEPTED.includes(f.type) || f.size === 0 || f.size > MAX_BYTES) {
      setError(DOC_FILE_INVALID);
      return;
    }
    setFile(f);
    setTitle(f.name.replace(/\.[^.]+$/, ""));
  }, []);

  const analyze = useCallback(async () => {
    if (!file || busy) return;
    setError(null);
    setStage(0);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (title.trim()) form.set("title", title.trim());
      if (matterId) form.set("matterId", matterId);

      const res = await fetch("/api/documents/analyze", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        let message = DOC_FILE_INVALID;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // keep the calm default
        }
        setError(message);
        return;
      }
      const data = (await res.json()) as AnalyzeResponse;
      if (data.documentId) {
        router.push(`/documents/${data.documentId}`);
        return; // keep the progress state up through navigation
      }
      setResult(data);
      setFile(null);
    } catch {
      setError(
        "Justice couldn't finish reading that document. Nothing was lost — please try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }, [file, busy, title, matterId, router]);

  // Local-preview result: render the signature view inline.
  if (result) {
    const matter = matters.find((m) => m.id === result.matterId);
    return (
      <div className="space-y-5">
        <Alert tone="info" title={result.title}>
          Analysis complete. In this local preview the document isn&apos;t
          saved — connect Supabase to keep a library.
        </Alert>
        <AnalysisView
          analysis={result.analysis}
          jurisdiction={
            matter
              ? { country: matter.country, state: matter.state }
              : viewerJurisdiction
          }
          matterId={result.matterId}
          canAddDeadlines={!isDemo}
        />
        <Button variant="secondary" size="sm" onClick={() => setResult(null)}>
          Analyze another document
        </Button>
      </div>
    );
  }

  if (busy) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center rounded-xl border border-border bg-surface px-6 py-14 text-center shadow-[var(--shadow-sm)]"
      >
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
          <FileText className="h-6 w-6 text-accent" aria-hidden="true" />
          <Loader2
            className="absolute -bottom-1.5 -right-1.5 h-5 w-5 text-accent motion-safe:animate-spin"
            aria-hidden="true"
          />
        </span>
        <p className="mt-5 font-serif text-xl font-medium tracking-tight text-foreground">
          {STAGES[stage]}
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          A careful read takes a few seconds. Every finding will link back to
          the exact clause it comes from.
        </p>
        <div className="mt-6 h-1 w-56 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700 ease-[var(--ease-refined)]"
            style={{ width: `${((stage + 1) / STAGES.length) * 90}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150",
          dragging
            ? "border-accent bg-accent-soft"
            : "border-border bg-surface hover:border-border-strong",
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft">
          <FileUp className="h-6 w-6 text-accent" aria-hidden="true" />
        </span>
        <p className="mt-4 font-medium text-foreground">
          Drop a legal document here
        </p>
        <p className="mt-1 text-sm text-muted">
          Contract, notice, court paper, or agreement — PDF or a clear photo,
          up to 10 MB.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
        >
          Choose a file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          aria-label="Choose a document to analyze"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {file && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)] animate-fade-in-up">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
              <FileText className="h-5 w-5 text-accent" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {file.name}
              </p>
              <p className="text-xs text-muted">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <button
              type="button"
              aria-label="Remove file"
              onClick={() => setFile(null)}
              className="rounded-md p-1.5 text-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="doc-title">
              <Input
                id="doc-title"
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field
              label="Matter"
              htmlFor="doc-matter"
              hint="Where this document (and its deadlines) will live."
            >
              <Select
                id="doc-matter"
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
          </div>

          <Button onClick={analyze} disabled={busy}>
            Analyze document
          </Button>
        </div>
      )}
    </div>
  );
}

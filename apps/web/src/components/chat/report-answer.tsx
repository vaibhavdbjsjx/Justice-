"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/legal/company";

const REASONS = [
  "Inaccurate or out of date",
  "Wrong jurisdiction",
  "Harmful or offensive",
  "Something else",
];

/** Report an AI answer (App Store Guideline 1.2 asks for a way to do this). */
export function ReportAnswer({
  excerpt,
  kind = "ai_answer",
  referenceId,
}: {
  excerpt: string;
  kind?: "ai_answer" | "ai_document";
  referenceId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function submit() {
    setState("sending");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, reason, details, excerpt, referenceId }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "sent") {
    return (
      <p className="px-2 py-1 text-xs text-muted">
        Thanks. We review every report.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-foreground"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        Report
      </button>
    );
  }

  return (
    <div className="mt-2 w-full space-y-2 rounded-lg border border-border bg-surface-sunken p-3">
      <label className="block text-xs font-medium text-foreground">
        What&rsquo;s wrong with this answer?
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm font-normal text-foreground"
        >
          {REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Add any details (optional)"
        aria-label="Details"
        className="block w-full resize-none rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-foreground placeholder:text-muted"
      />
      {state === "failed" && (
        <p className="text-xs text-alert">
          That didn&rsquo;t send. Please try again or email {SUPPORT_EMAIL}.
        </p>
      )}
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={state === "sending"}
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground disabled:opacity-50"
        >
          {state === "sending" ? "Sending…" : "Send report"}
        </button>
      </div>
    </div>
  );
}

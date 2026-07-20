"use client";

import { Download, FileText, ListTodo, Scale } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReviewBeforeUse } from "@/components/compliance/review-before-use";
import { DisclaimerBanner } from "@/components/compliance/disclaimer-banner";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { useDocExport } from "./use-doc-export";
import type { GeneratedDocument } from "@/lib/generation/types";

/**
 * Rendered generated document (Phase 6): "Review before use" leads, then the
 * draft with its placeholders/judgment-call checklist beside it, and
 * PDF/DOCX export (both carry the draft notice + signature block).
 */
export function GeneratedDocView({
  generated,
}: {
  generated: GeneratedDocument;
}) {
  const { error, exporting, download: exportDoc } = useDocExport();
  const download = (format: "pdf" | "docx") =>
    exportDoc(generated.title, generated.body_markdown, format);

  const hasChecklist =
    generated.placeholders.length > 0 || generated.review_flags.length > 0;

  return (
    <div className="space-y-5">
      <ReviewBeforeUse />

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          size="sm"
          onClick={() => download("pdf")}
          disabled={exporting !== null}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting === "pdf" ? "Preparing…" : "Download PDF"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => download("docx")}
          disabled={exporting !== null}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {exporting === "docx" ? "Preparing…" : "Download DOCX"}
        </Button>
        <p className="text-xs text-muted">
          Exports include the draft notice and a lawyer review block.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* The draft itself — document surface, serif via markdown headings */}
        <Card className="order-2 min-w-0 p-6 sm:p-8 lg:order-1">
          <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            {generated.title}
          </h2>
          <div className="legal-prose mt-5">
            <ChatMarkdown content={generated.body_markdown} />
          </div>
        </Card>

        {/* Before-you-send checklist */}
        <aside
          aria-label="Before you use this draft"
          className="order-1 space-y-5 lg:order-2 lg:sticky lg:top-24 lg:self-start"
        >
          {hasChecklist && (
            <section aria-label="Checklist">
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <ListTodo className="h-4 w-4 text-accent" aria-hidden="true" />
                Before you send this
              </h3>
              <div className="space-y-2.5">
                {generated.placeholders.length > 0 && (
                  <Card className="p-3.5">
                    <p className="text-sm font-medium text-foreground">
                      Fill in the placeholders
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {generated.placeholders.map((p) => (
                        <li
                          key={p}
                          className="font-mono text-xs text-alert"
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                {generated.review_flags.map((flag, i) => (
                  <Card key={i} className="border-l-2 border-l-accent p-3.5">
                    <p className="text-sm leading-relaxed text-muted-strong">
                      {flag}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {generated.jurisdiction_caveat && (
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-strong">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              {generated.jurisdiction_caveat}
            </p>
          )}

          <DisclaimerBanner variant="compact" />
        </aside>
      </div>
    </div>
  );
}

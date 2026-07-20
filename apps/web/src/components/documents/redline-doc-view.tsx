"use client";

import { Download, FileText, GitCompareArrows, Scale } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { RESEARCH_ACCELERATOR_NOTICE } from "@/lib/legal/disclaimers";
import type { RedlineChangeKind, RedlineResult } from "@/lib/drafting/types";
import { useDocExport } from "./use-doc-export";

/**
 * Rendered redline (Phase 7, Part 4.3): the complete revised draft beside an
 * accounted-for change log — every edit with its kind, the before/after
 * excerpts, and the rationale. The lawyer stays in control: nothing moved
 * silently. Exports reuse the Phase 6 pipeline (draft notice + review block).
 */

const kindMeta: Record<
  RedlineChangeKind,
  { label: string; tone: "accent" | "alert" | "neutral" }
> = {
  substantive: { label: "Substantive", tone: "accent" },
  risk: { label: "Risk", tone: "alert" },
  clarity: { label: "Clarity", tone: "neutral" },
};

export function RedlineDocView({ redline }: { redline: RedlineResult }) {
  const { error, exporting, download } = useDocExport();

  return (
    <div className="space-y-5">
      <Alert tone="info" title="What changed">
        {redline.summary}
      </Alert>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          size="sm"
          onClick={() => download(redline.title, redline.revised_markdown, "pdf")}
          disabled={exporting !== null}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting === "pdf" ? "Preparing…" : "Download PDF"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => download(redline.title, redline.revised_markdown, "docx")}
          disabled={exporting !== null}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {exporting === "docx" ? "Preparing…" : "Download DOCX"}
        </Button>
        <p className="text-xs text-muted">
          Exports carry the revised text with the draft notice and review block.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* The revised draft — document surface */}
        <Card className="order-2 min-w-0 p-6 sm:p-8 lg:order-1">
          <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            {redline.title}
          </h2>
          <div className="legal-prose mt-5">
            <ChatMarkdown content={redline.revised_markdown} />
          </div>
        </Card>

        {/* Change log */}
        <aside
          aria-label="Change log"
          className="order-1 space-y-5 lg:order-2 lg:sticky lg:top-24 lg:self-start"
        >
          <section aria-label="Changes">
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <GitCompareArrows className="h-4 w-4 text-accent" aria-hidden="true" />
              Changes ({redline.changes.length})
            </h3>
            {redline.changes.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted">
                No meaningful changes were needed — see the summary above.
              </p>
            ) : (
              <ol className="space-y-2.5">
                {redline.changes.map((change, i) => {
                  const meta = kindMeta[change.kind] ?? kindMeta.clarity;
                  return (
                    <li key={i}>
                      <Card className="p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug text-foreground">
                            {change.heading}
                          </p>
                          <Badge tone={meta.tone} className="shrink-0">
                            {meta.label}
                          </Badge>
                        </div>
                        {change.original_excerpt && (
                          <p className="mt-2 rounded-md bg-surface-sunken px-2.5 py-1.5 text-xs leading-relaxed text-muted line-through decoration-alert/60">
                            {change.original_excerpt}
                          </p>
                        )}
                        {change.revised_excerpt && (
                          <p className="mt-1.5 rounded-md bg-accent-soft px-2.5 py-1.5 text-xs leading-relaxed text-foreground">
                            {change.revised_excerpt}
                          </p>
                        )}
                        <p className="mt-2 text-xs leading-relaxed text-muted-strong">
                          {change.rationale}
                        </p>
                      </Card>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {redline.review_flags.length > 0 && (
            <section aria-label="Check before relying on this">
              <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-muted">
                Check before relying on this
              </h3>
              <div className="space-y-2.5">
                {redline.review_flags.map((flag, i) => (
                  <Card key={i} className="border-l-2 border-l-accent p-3.5">
                    <p className="text-sm leading-relaxed text-muted-strong">
                      {flag}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {redline.jurisdiction_caveat && (
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-strong">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              {redline.jurisdiction_caveat}
            </p>
          )}

          <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
            {RESEARCH_ACCELERATOR_NOTICE}
          </p>
        </aside>
      </div>
    </div>
  );
}

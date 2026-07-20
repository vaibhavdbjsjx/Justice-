import { BookMarked, ExternalLink, Landmark, Scale, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESEARCH_ACCELERATOR_NOTICE } from "@/lib/legal/disclaimers";
import type { Citation, CitationType } from "@/lib/legal/citations";

/**
 * Source citation for lawyer-side research (Part 5.6 / Part 8). Every
 * substantive claim should be able to show its source, and the UI nudges the
 * lawyer to verify rather than presenting the AI as authoritative.
 * Types + the "## Sources" parser live in lib/legal/citations.ts (Phase 7).
 */
export type { Citation, CitationType };

const typeMeta: Record<CitationType, { label: string; Icon: typeof Scale }> = {
  case: { label: "Case", Icon: Scale },
  statute: { label: "Statute", Icon: Landmark },
  regulation: { label: "Regulation", Icon: ScrollText },
  secondary: { label: "Secondary", Icon: BookMarked },
};

export function SourceCitation({
  citation,
  index,
  className,
}: {
  citation: Citation;
  index?: number;
  className?: string;
}) {
  const { Icon, label } = typeMeta[citation.type];
  return (
    <li
      className={cn(
        "group rounded-lg border border-border bg-surface p-3 transition-colors duration-150 hover:border-border-strong",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {typeof index === "number" && (
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-semibold text-foreground"
            aria-hidden="true"
          >
            {index}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Icon className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {label}
            </span>
            {citation.jurisdiction && (
              <span className="text-[11px] text-muted">· {citation.jurisdiction}</span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium leading-snug text-foreground">
            {citation.title}
          </p>
          {citation.reference && (
            <p className="font-mono text-xs text-muted-strong">{citation.reference}</p>
          )}
          {citation.snippet && (
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">
              {citation.snippet}
            </p>
          )}
          {citation.url && (
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              Verify source
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export function CitationList({
  citations,
  showVerifyNotice = true,
  className,
}: {
  citations: Citation[];
  showVerifyNotice?: boolean;
  className?: string;
}) {
  if (citations.length === 0) return null;
  return (
    <section aria-label="Sources" className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Sources ({citations.length})
        </h4>
      </div>
      <ol className="space-y-2">
        {citations.map((c, i) => (
          <SourceCitation key={c.id} citation={c} index={i + 1} />
        ))}
      </ol>
      {showVerifyNotice && (
        <p className="pt-1 text-[11px] leading-relaxed text-muted">
          {RESEARCH_ACCELERATOR_NOTICE}
        </p>
      )}
    </section>
  );
}

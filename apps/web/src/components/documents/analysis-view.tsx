"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  CalendarClock,
  CalendarPlus,
  FileText,
  ListChecks,
  Scale,
  ShieldAlert,
} from "lucide-react";
import { AiLegalOutput } from "@/components/compliance/ai-legal-output";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { addDeadline } from "@/lib/matters/actions";
import type {
  DocumentAnalysis,
  ImportantDate,
  KeyObligation,
  RiskyClause,
} from "@/lib/documents/analysis-types";
import type { Jurisdiction } from "@/lib/legal/jurisdiction";
import { cn } from "@/lib/utils";

/**
 * The signature Document Intelligence view (Part 5.5): verbatim document text
 * beside its plain-language findings, with smooth two-way highlight-linking —
 * hover/focus/tap a finding and its source clauses light up (and scroll into
 * view); hover a clause and the findings built on it light up.
 */

type FindingKey = string; // e.g. "risk-0", "obligation-2", "date-1"

export function AnalysisView({
  analysis,
  jurisdiction,
  matterId,
  canAddDeadlines,
}: {
  analysis: DocumentAnalysis;
  jurisdiction: Jurisdiction | null;
  /** Set when the document belongs to a matter (enables timeline add). */
  matterId: string | null;
  canAddDeadlines: boolean;
}) {
  const [activeFinding, setActiveFinding] = useState<FindingKey | null>(null);
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const segmentRefs = useRef(new Map<number, HTMLElement>());

  const findings = useMemo(() => buildFindingIndex(analysis), [analysis]);

  // Segments lit by the active finding; findings lit by the hovered segment.
  const litSegments = useMemo(() => {
    if (activeFinding) return new Set(findings.get(activeFinding) ?? []);
    return new Set<number>();
  }, [activeFinding, findings]);

  const litFindings = useMemo(() => {
    if (activeSegment === null) return new Set<FindingKey>();
    const keys = new Set<FindingKey>();
    for (const [key, ids] of findings) {
      if (ids.includes(activeSegment)) keys.add(key);
    }
    return keys;
  }, [activeSegment, findings]);

  const jumpToSegments = useCallback((ids: number[]) => {
    const first = ids[0];
    if (first === undefined) return;
    const el = segmentRefs.current.get(first);
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
  }, []);

  const highRisk = analysis.risky_or_unusual_clauses.some(
    (r) => r.severity === "high",
  );

  return (
    <AiLegalOutput
      jurisdiction={jurisdiction}
      highStakes={highRisk}
      disclaimer="full"
    >
      <div className="space-y-6">
        {/* Plain-language summary */}
        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="navy" className="capitalize">
              {analysis.document_type}
            </Badge>
            <Badge tone="neutral">{analysis.detected_language}</Badge>
            {analysis.truncated && (
              <Badge tone="alert">Long document — partially analyzed</Badge>
            )}
          </div>
          <p className="legal-prose text-[15px] text-foreground">
            {analysis.plain_language_summary}
          </p>
          {analysis.jurisdiction_note && (
            <p className="flex items-start gap-2 border-t border-border pt-3 text-sm leading-relaxed text-muted-strong">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              {analysis.jurisdiction_note}
            </p>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* Original text — order-2 on mobile so findings lead */}
          <section
            aria-label="Original document text"
            className="order-2 min-w-0 lg:order-1"
            onMouseLeave={() => setActiveSegment(null)}
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Original document
            </h2>
            <Card className="space-y-1 p-5 sm:p-6">
              {analysis.segments.map((s) => {
                const lit = litSegments.has(s.id);
                const related = findings.size > 0 && segmentHasFinding(findings, s.id);
                return (
                  <div
                    key={s.id}
                    ref={(el) => {
                      if (el) segmentRefs.current.set(s.id, el);
                      else segmentRefs.current.delete(s.id);
                    }}
                    onMouseEnter={() => related && setActiveSegment(s.id)}
                    className={cn(
                      "-mx-2 scroll-mt-24 rounded-lg px-2 py-1.5 transition-colors duration-300 ease-[var(--ease-refined)]",
                      lit && "bg-accent-soft ring-1 ring-accent/40",
                    )}
                  >
                    {s.heading && (
                      <h3 className="mb-1 mt-2 font-serif text-[15px] font-medium tracking-tight text-foreground">
                        {s.heading}
                      </h3>
                    )}
                    <p className="legal-prose whitespace-pre-wrap text-[15px] text-foreground/90">
                      {s.text}
                    </p>
                  </div>
                );
              })}
            </Card>
          </section>

          {/* Findings — sticky companion on desktop */}
          <aside
            aria-label="Plain-language findings"
            className="order-1 space-y-6 lg:order-2 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto lg:pb-4 lg:pr-1"
            onMouseLeave={() => setActiveFinding(null)}
          >
            <RiskSection
              clauses={analysis.risky_or_unusual_clauses}
              litFindings={litFindings}
              onActivate={setActiveFinding}
              onJump={jumpToSegments}
            />
            <ObligationSection
              obligations={analysis.key_obligations}
              litFindings={litFindings}
              onActivate={setActiveFinding}
              onJump={jumpToSegments}
            />
            <DatesSection
              dates={analysis.important_dates}
              litFindings={litFindings}
              onActivate={setActiveFinding}
              onJump={jumpToSegments}
              matterId={matterId}
              canAddDeadlines={canAddDeadlines}
            />
          </aside>
        </div>
      </div>
    </AiLegalOutput>
  );
}

// ---- Finding sections -------------------------------------------------------

function RiskSection({
  clauses,
  litFindings,
  onActivate,
  onJump,
}: {
  clauses: RiskyClause[];
  litFindings: Set<FindingKey>;
  onActivate: (key: FindingKey | null) => void;
  onJump: (ids: number[]) => void;
}) {
  if (clauses.length === 0) {
    return (
      <FindingGroup icon={ShieldAlert} title="Risky or unusual clauses">
        <p className="text-sm leading-relaxed text-muted">
          Nothing stood out as unusual or one-sided. Standard caution still
          applies before signing.
        </p>
      </FindingGroup>
    );
  }
  return (
    <FindingGroup icon={ShieldAlert} title="Risky or unusual clauses">
      {clauses.map((c, i) => {
        const key = `risk-${i}`;
        return (
          <FindingCard
            key={key}
            findingKey={key}
            lit={litFindings.has(key)}
            accent={c.severity === "high" ? "alert" : "gold"}
            onActivate={onActivate}
            onJump={() => onJump(c.segment_ids)}
            ariaLabel={`Risky clause: ${c.clause_excerpt_summary}. Show in document.`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug text-foreground">
                {c.clause_excerpt_summary}
              </p>
              <Badge tone={c.severity === "high" ? "alert" : "accent"}>
                {c.severity === "high" ? "High risk" : "Caution"}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-strong">
              {c.why_flagged}
            </p>
            {c.section_reference && (
              <p className="mt-1.5 text-xs font-medium text-muted">
                {c.section_reference}
              </p>
            )}
          </FindingCard>
        );
      })}
    </FindingGroup>
  );
}

function ObligationSection({
  obligations,
  litFindings,
  onActivate,
  onJump,
}: {
  obligations: KeyObligation[];
  litFindings: Set<FindingKey>;
  onActivate: (key: FindingKey | null) => void;
  onJump: (ids: number[]) => void;
}) {
  if (obligations.length === 0) return null;
  return (
    <FindingGroup icon={ListChecks} title="Key obligations">
      {obligations.map((o, i) => {
        const key = `obligation-${i}`;
        return (
          <FindingCard
            key={key}
            findingKey={key}
            lit={litFindings.has(key)}
            accent="neutral"
            onActivate={onActivate}
            onJump={() => onJump(o.segment_ids)}
            ariaLabel={`Obligation for ${o.party}: ${o.obligation}. Show in document.`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {o.party}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {o.obligation}
            </p>
            {o.deadline_if_any && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-alert">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                {o.deadline_if_any}
              </p>
            )}
          </FindingCard>
        );
      })}
    </FindingGroup>
  );
}

function DatesSection({
  dates,
  litFindings,
  onActivate,
  onJump,
  matterId,
  canAddDeadlines,
}: {
  dates: ImportantDate[];
  litFindings: Set<FindingKey>;
  onActivate: (key: FindingKey | null) => void;
  onJump: (ids: number[]) => void;
  matterId: string | null;
  canAddDeadlines: boolean;
}) {
  if (dates.length === 0) return null;
  return (
    <FindingGroup icon={CalendarClock} title="Important dates">
      {dates.map((d, i) => {
        const key = `date-${i}`;
        return (
          <FindingCard
            key={key}
            findingKey={key}
            lit={litFindings.has(key)}
            accent="neutral"
            onActivate={onActivate}
            onJump={() => onJump(d.segment_ids)}
            ariaLabel={`Important date: ${d.label}, ${d.date_text}. Show in document.`}
          >
            <p className="text-sm font-medium leading-snug text-foreground">
              {d.label}
            </p>
            <p className="mt-1 text-sm text-muted-strong">{d.date_text}</p>
            {canAddDeadlines && matterId && (
              <AddToTimeline matterId={matterId} date={d} />
            )}
          </FindingCard>
        );
      })}
    </FindingGroup>
  );
}

function AddToTimeline({
  matterId,
  date,
}: {
  matterId: string;
  date: ImportantDate;
}) {
  const [state, setState] = useState<"idle" | "added" | "error">("idle");
  const [pending, startTransition] = useTransition();

  if (state === "added") {
    return (
      <p className="mt-2 text-xs font-medium text-success">Added to timeline</p>
    );
  }
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          startTransition(async () => {
            const result = await addDeadline(matterId, {
              title: date.label,
              dueDate: date.iso_date,
            });
            setState(result?.error ? "error" : "added");
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent-soft disabled:opacity-50"
      >
        <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
        {pending ? "Adding…" : "Add to matter timeline"}
      </button>
      {state === "error" && (
        <Alert tone="error" className="mt-2">
          We couldn&apos;t add that to the timeline just now.
        </Alert>
      )}
    </div>
  );
}

// ---- Shared building blocks ---------------------------------------------

function FindingGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
        {title}
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function FindingCard({
  findingKey,
  lit,
  accent,
  onActivate,
  onJump,
  ariaLabel,
  children,
}: {
  findingKey: FindingKey;
  lit: boolean;
  accent: "alert" | "gold" | "neutral";
  onActivate: (key: FindingKey | null) => void;
  onJump: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onMouseEnter={() => onActivate(findingKey)}
      onFocus={() => onActivate(findingKey)}
      onBlur={() => onActivate(null)}
      onClick={onJump}
      className={cn(
        "block w-full rounded-xl border bg-surface p-3.5 text-left shadow-[var(--shadow-sm)]",
        "transition-all duration-300 ease-[var(--ease-refined)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
        accent === "alert" && "border-l-2 border-alert/40 border-l-alert",
        accent === "gold" && "border-l-2 border-border border-l-accent",
        accent === "neutral" && "border-border",
        lit && "border-accent bg-accent-soft",
        !lit && "hover:border-border-strong",
      )}
    >
      {children}
    </button>
  );
}

// ---- Index helpers ----------------------------------------------------------

function buildFindingIndex(
  a: DocumentAnalysis,
): Map<FindingKey, number[]> {
  const map = new Map<FindingKey, number[]>();
  a.risky_or_unusual_clauses.forEach((c, i) => map.set(`risk-${i}`, c.segment_ids));
  a.key_obligations.forEach((o, i) => map.set(`obligation-${i}`, o.segment_ids));
  a.important_dates.forEach((d, i) => map.set(`date-${i}`, d.segment_ids));
  return map;
}

function segmentHasFinding(
  index: Map<FindingKey, number[]>,
  segmentId: number,
): boolean {
  for (const ids of index.values()) {
    if (ids.includes(segmentId)) return true;
  }
  return false;
}

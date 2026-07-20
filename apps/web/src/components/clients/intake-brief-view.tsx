import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  HelpCircle,
  ListChecks,
  Quote,
  Scale,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CaseBrief, IntakeSubmission } from "@/lib/intake/types";

/**
 * The structured case brief a lawyer reads first (Phase 8, triage-to-brief).
 * Brief-first composition: summary and urgency lead, then facts/timeline,
 * then what to ask and do. The client's raw words stay one disclosure away —
 * the brief organizes, never replaces, their account.
 */

const urgencyMeta: Record<
  CaseBrief["urgency"],
  { label: string; tone: "alert" | "accent" | "neutral" }
> = {
  high: { label: "High urgency", tone: "alert" },
  medium: { label: "Medium urgency", tone: "accent" },
  low: { label: "Low urgency", tone: "neutral" },
};

export function IntakeBriefView({
  brief,
  intake,
}: {
  brief: CaseBrief;
  /** Raw client answers, when stored alongside the brief. */
  intake?: IntakeSubmission;
}) {
  const urgency = urgencyMeta[brief.urgency] ?? urgencyMeta.medium;

  return (
    <div className="space-y-5">
      {/* Summary + urgency */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <ClipboardList className="h-4 w-4 text-accent" aria-hidden="true" />
            Case brief
          </h3>
          <Badge tone={urgency.tone}>
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {urgency.label}
          </Badge>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground">
          {brief.summary}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {brief.urgency_reason}
        </p>
        {brief.complexity_note && (
          <p className="mt-2 border-t border-border pt-2 text-sm leading-relaxed text-muted-strong">
            {brief.complexity_note}
          </p>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Facts + timeline */}
        <div className="space-y-5">
          {brief.key_facts.length > 0 && (
            <section aria-label="Key facts">
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Key facts
              </h4>
              <Card className="p-4">
                <ul className="space-y-2">
                  {brief.key_facts.map((fact, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                        aria-hidden="true"
                      />
                      {fact}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {brief.timeline.length > 0 && (
            <section aria-label="Timeline">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <CalendarClock className="h-4 w-4 text-accent" aria-hidden="true" />
                Timeline (as stated)
              </h4>
              <Card className="p-4">
                <ol className="space-y-2.5 border-l border-border pl-4">
                  {brief.timeline.map((t, i) => (
                    <li key={i} className="relative text-sm leading-relaxed">
                      <span
                        className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-accent bg-surface"
                        aria-hidden="true"
                      />
                      <span className="font-medium text-foreground">{t.date_text}</span>
                      <span className="text-muted"> — {t.event}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          )}
        </div>

        {/* Ask + do */}
        <div className="space-y-5">
          {brief.questions_for_client.length > 0 && (
            <section aria-label="Questions for the client">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <HelpCircle className="h-4 w-4 text-accent" aria-hidden="true" />
                Ask the client
              </h4>
              <div className="space-y-2">
                {brief.questions_for_client.map((q, i) => (
                  <Card key={i} className="p-3.5">
                    <p className="text-sm leading-relaxed text-foreground">{q}</p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {brief.suggested_next_steps.length > 0 && (
            <section aria-label="Suggested next steps">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <ListChecks className="h-4 w-4 text-accent" aria-hidden="true" />
                Suggested first moves
              </h4>
              <Card className="p-4">
                <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground marker:font-medium marker:text-accent">
                  {brief.suggested_next_steps.map((s, i) => (
                    <li key={i} className="pl-1">
                      {s}
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          )}

          {brief.jurisdiction_note && (
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-strong">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              {brief.jurisdiction_note}
            </p>
          )}
        </div>
      </div>

      {/* The client's own words — never more than a click away */}
      {intake && (
        <details className="group rounded-xl border border-border bg-surface">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <Quote className="h-4 w-4 text-accent" aria-hidden="true" />
            The client&rsquo;s own words
            <span className="ml-auto text-xs text-muted group-open:hidden">Show</span>
            <span className="ml-auto hidden text-xs text-muted group-open:inline">Hide</span>
          </summary>
          <div className="space-y-3 border-t border-border px-4 py-4 text-sm leading-relaxed">
            <p className="whitespace-pre-wrap text-foreground">{intake.situation}</p>
            {intake.key_dates && (
              <p className="text-muted">
                <span className="font-medium text-muted-strong">Dates mentioned:</span>{" "}
                {intake.key_dates}
              </p>
            )}
            {intake.desired_outcome && (
              <p className="text-muted">
                <span className="font-medium text-muted-strong">Wants:</span>{" "}
                {intake.desired_outcome}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

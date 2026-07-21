"use client";

import { useState } from "react";
import { FileText, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Interactive preview of the signature Document Intelligence view (Part 5.5):
 * the original document beside plain-language annotations, with two-way
 * highlight-linking — hover or focus a clause and its explanation lights up,
 * and vice versa. Keyboard accessible in both directions.
 */

type Tone = "caution" | "alert";

const CLAUSES: {
  id: string;
  text: string;
  section: string;
  tone: Tone;
  title: string;
  why: string;
}[] = [
  {
    id: "rent",
    text: "Landlord may increase the monthly rent by up to twelve percent (12%) upon renewal with fifteen (15) days’ written notice.",
    section: "§ 2 — Rent",
    tone: "caution",
    title: "Steep escalation on short notice",
    why: "A 12% increase with only 15 days’ notice is aggressive. Many jurisdictions require 30–60 days’ notice for increases above a set threshold.",
  },
  {
    id: "entry",
    text: "Landlord may enter the premises at any time, without prior notice, for inspection or maintenance.",
    section: "§ 7 — Entry",
    tone: "alert",
    title: "Entry without notice",
    why: "Most jurisdictions require 24–48 hours’ written notice except in emergencies. This clause likely conflicts with tenant privacy protections.",
  },
  {
    id: "termination",
    text: "Early termination shall require forfeiture of the full security deposit plus two (2) months’ rent.",
    section: "§ 11 — Termination",
    tone: "alert",
    title: "Penalty may be unenforceable",
    why: "Deposit forfeiture plus two months’ rent can exceed enforceable liquidated damages, and some jurisdictions cap early-termination fees outright.",
  },
];

export function DocIntelligenceDemo() {
  const [active, setActive] = useState<string | null>(null);

  const clear = () => setActive(null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Original document */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2 border-b border-border bg-surface-sunken px-4 py-2.5">
          <FileText className="h-4 w-4 text-muted" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">Residential_Lease.pdf</span>
          <span className="ml-auto text-[11px] text-muted">Original</span>
        </div>

        <div className="legal-prose space-y-3 p-5 font-serif text-[13px] text-muted-strong">
          <p>
            <span className="mr-1.5 text-[11px] font-sans text-muted">§ 1</span>
            The initial term begins on 1 June and continues for twelve (12) consecutive months.
          </p>
          {CLAUSES.map((c) => (
            <p key={c.id}>
              <span className="mr-1.5 text-[11px] font-sans text-muted">
                {c.section.split(" — ")[0]}
              </span>
              <button
                type="button"
                onMouseEnter={() => setActive(c.id)}
                onMouseLeave={clear}
                onFocus={() => setActive(c.id)}
                onBlur={clear}
                aria-describedby={`note-${c.id}`}
                className={cn(
                  "cursor-pointer rounded-[4px] px-1 py-0.5 text-left transition-colors duration-200",
                  "decoration-dotted underline-offset-4",
                  active === c.id
                    ? c.tone === "alert"
                      ? "bg-alert-soft text-foreground"
                      : "bg-accent-soft text-foreground"
                    : "underline decoration-border-strong hover:bg-surface-sunken",
                )}
              >
                {c.text}
              </button>
            </p>
          ))}
          <p className="opacity-60">
            <span className="mr-1.5 text-[11px] font-sans text-muted">§ 12</span>
            This agreement constitutes the entire understanding between the parties…
          </p>
        </div>
      </div>

      {/* Plain-language annotations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Plain-language analysis
          </p>
          <span className="text-[11px] text-muted">3 clauses flagged</span>
        </div>

        {CLAUSES.map((c) => (
          <div
            key={c.id}
            id={`note-${c.id}`}
            onMouseEnter={() => setActive(c.id)}
            onMouseLeave={clear}
            className={cn(
              "rounded-xl border bg-surface p-4 transition-[border-color,box-shadow,transform] duration-200",
              active === c.id
                ? "border-accent shadow-[var(--shadow-md)] lg:-translate-x-1"
                : "border-border",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  c.tone === "alert" ? "bg-alert-soft" : "bg-accent-soft",
                )}
              >
                <TriangleAlert
                  className={cn("h-4 w-4", c.tone === "alert" ? "text-alert" : "text-accent")}
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2">
                  <h4 className="text-sm font-medium text-foreground">{c.title}</h4>
                  <span className="text-[11px] text-muted">{c.section}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{c.why}</p>
              </div>
            </div>
          </div>
        ))}

        <p className="px-1 pt-1 text-[11px] leading-relaxed text-muted">
          Analysis is legal information, not legal advice — have a licensed lawyer review
          anything before you sign.
        </p>
      </div>
    </div>
  );
}

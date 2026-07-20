import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  FileText,
  FolderKanban,
  MessagesSquare,
  Plus,
} from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { listMatters, type MatterListItem } from "@/lib/matters/queries";
import { categoryLabel } from "@/lib/matters/categories";
import { MatterStatusBadge } from "@/components/matters/status-badge";
import { JurisdictionIndicator } from "@/components/compliance/jurisdiction-indicator";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MatterStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Matters" };

const FILTERS: { value: "all" | MatterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
];

/**
 * Matter list (Part 4.1). A matter groups chat, documents, and deadlines for
 * one legal situation; cards surface what needs attention next.
 */
export default async function MattersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }, viewer] = await Promise.all([searchParams, getViewer()]);
  if (!viewer.user) return null; // (app) layout redirects

  const filter = FILTERS.some((f) => f.value === status) ? status : "all";
  const all = await listMatters(viewer.user.id);
  const matters =
    filter === "all" ? all : all.filter((m) => m.status === filter);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
        <div>
          <p className="text-sm text-muted">Your legal situations, organized</p>
          <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-foreground">
            Matters
          </h1>
        </div>
        <Link href="/matters/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New matter
        </Link>
      </header>

      <nav aria-label="Filter matters by status" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = f.value === filter;
          const count =
            f.value === "all"
              ? all.length
              : all.filter((m) => m.status === f.value).length;
          return (
            <Link
              key={f.value}
              href={f.value === "all" ? "/matters" : `/matters?status=${f.value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-accent-soft text-foreground"
                  : "text-muted hover:bg-surface-sunken hover:text-foreground",
              )}
            >
              {f.label}
              <span className="ml-1.5 text-xs text-muted">{count}</span>
            </Link>
          );
        })}
      </nav>

      {matters.length === 0 ? (
        <EmptyState filtered={filter !== "all"} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {matters.map((m) => (
            <li key={m.id}>
              <MatterCard matter={m} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MatterCard({ matter: m }: { matter: MatterListItem }) {
  const next = m.openDeadlines[0];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(next?.due_date && next.due_date < today);

  return (
    <Link href={`/matters/${m.id}`} className="group block h-full">
      <Card className="flex h-full flex-col p-5 transition-colors duration-150 hover:border-accent">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {categoryLabel(m.category)}
          </p>
          <MatterStatusBadge status={m.status} />
        </div>
        <h2 className="mt-2 font-serif text-lg font-medium leading-snug tracking-tight text-foreground">
          {m.title}
        </h2>

        <div className="mt-3">
          <JurisdictionIndicator
            jurisdiction={{
              country: m.jurisdiction_country,
              state: m.jurisdiction_state,
            }}
          />
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {m.messageCount} message{m.messageCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {m.documentCount} document{m.documentCount === 1 ? "" : "s"}
          </span>
          {next && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-medium",
                overdue ? "text-alert" : "text-muted-strong",
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {overdue ? "Overdue: " : "Next: "}
              {next.title}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft">
        <FolderKanban className="h-6 w-6 text-accent" aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-serif text-xl font-medium text-foreground">
        {filtered ? "Nothing here" : "No matters yet"}
      </h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
        {filtered
          ? "No matters with this status. Try another filter."
          : "A matter keeps one legal situation together — the conversation, documents, and deadlines — so nothing slips."}
      </p>
      {!filtered && (
        <Link
          href="/matters/new"
          className={buttonVariants({ size: "sm", className: "mt-5" })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Start your first matter
        </Link>
      )}
    </div>
  );
}

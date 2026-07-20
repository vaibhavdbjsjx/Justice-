"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check, Plus, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addDeadline,
  deleteDeadline,
  setDeadlineStatus,
} from "@/lib/matters/actions";
import type { Deadline } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Matter timeline (Part 4.1): deadlines with add / complete / delete and
 * overdue emphasis (alert-terracotta, muted — Part 5.2). Reminder *delivery*
 * is a later phase; `reminder_sent` already exists on the schema for it.
 */
export function DeadlineTimeline({
  matterId,
  deadlines,
}: {
  matterId: string;
  deadlines: Deadline[];
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...deadlines].sort((a, b) =>
    (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31"),
  );

  const submit = () => {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addDeadline(matterId, {
        title,
        dueDate: dueDate || null,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setTitle("");
        setDueDate("");
      }
    });
  };

  return (
    <div className="space-y-4">
      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          No deadlines yet. Add dates you can&apos;t afford to miss — notice
          periods, filing windows, court dates.
        </p>
      ) : (
        <ol className="space-y-2.5">
          {sorted.map((d) => (
            <DeadlineRow
              key={d.id}
              deadline={d}
              matterId={matterId}
              today={today}
              onError={setError}
            />
          ))}
        </ol>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-2.5 rounded-lg border border-border bg-surface-sunken/60 p-3"
      >
        <label htmlFor="deadline-title" className="sr-only">
          Deadline title
        </label>
        <Input
          id="deadline-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a deadline — e.g. “Respond to notice”"
          className="h-10 bg-surface"
        />
        <div className="flex items-center gap-2.5">
          <label htmlFor="deadline-date" className="sr-only">
            Due date
          </label>
          <Input
            id="deadline-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-10 flex-1 bg-surface"
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={pending || !title.trim()}
            className="h-10 shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      </form>
    </div>
  );
}

function DeadlineRow({
  deadline: d,
  matterId,
  today,
  onError,
}: {
  deadline: Deadline;
  matterId: string;
  today: string;
  onError: (msg: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const done = d.status === "completed";
  const overdue = !done && Boolean(d.due_date && d.due_date < today);

  const toggle = () => {
    onError(null);
    startTransition(async () => {
      const result = await setDeadlineStatus(
        d.id,
        matterId,
        done ? "upcoming" : "completed",
      );
      if (result?.error) onError(result.error);
    });
  };

  const remove = () => {
    onError(null);
    startTransition(async () => {
      const result = await deleteDeadline(d.id, matterId);
      if (result?.error) onError(result.error);
    });
  };

  return (
    <li
      className={cn(
        "group flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150",
        overdue
          ? "border-alert/30 bg-alert-soft"
          : "border-border bg-surface",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={
          done ? `Reopen deadline: ${d.title}` : `Mark done: ${d.title}`
        }
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150",
          done
            ? "border-success bg-success text-white"
            : "border-border-strong bg-surface hover:border-accent",
        )}
      >
        {done && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            done ? "text-muted line-through decoration-border-strong" : "text-foreground",
          )}
        >
          {d.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {formatDue(d.due_date)}
          {overdue && <Badge tone="alert">Overdue</Badge>}
        </p>
      </div>

      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label={`Delete deadline: ${d.title}`}
        className="rounded-md p-1 text-muted opacity-0 transition-opacity duration-150 hover:bg-surface-sunken hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function formatDue(dueDate: string | null): string {
  if (!dueDate) return "No date set";
  const due = new Date(`${dueDate}T00:00:00`);
  const label = due.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const days = Math.round(
    (due.getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000,
  );
  if (days === 0) return `${label} · today`;
  if (days === 1) return `${label} · tomorrow`;
  if (days > 1) return `${label} · in ${days} days`;
  if (days === -1) return `${label} · yesterday`;
  return `${label} · ${Math.abs(days)} days ago`;
}

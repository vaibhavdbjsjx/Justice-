"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, FolderKanban, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requestLawyer } from "@/lib/clients/actions";
import { ATTORNEY_CLIENT_NOTICE } from "@/lib/legal/disclaimers";

export type RequestableMatter = { id: string; title: string };

/**
 * "Work with this lawyer" (Phase 9 linking). The consumer shares one of
 * their matters — brief, documents, and thread travel with it. The request
 * stays 'invited' until the lawyer accepts.
 */
export function RequestLawyerPanel({
  lawyerId,
  lawyerName,
  matters,
  isDemo,
}: {
  lawyerId: string;
  lawyerName: string;
  matters: RequestableMatter[];
  isDemo: boolean;
}) {
  const [matterId, setMatterId] = useState(matters[0]?.id ?? "");
  const [intro, setIntro] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !matterId) return;
    setError(null);

    if (isDemo) {
      setSent(true);
      return;
    }

    setBusy(true);
    const result = await requestLawyer(lawyerId, matterId, intro);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <Card raised className="p-6 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-success-soft">
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
        </span>
        <h3 className="mt-3 font-serif text-xl font-medium tracking-tight text-foreground">
          Request sent
        </h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
          {lawyerName} can now review your matter and reply in its message
          thread. You&rsquo;ll see their response on the matter page.
        </p>
        {isDemo && (
          <p className="mt-3 text-xs text-muted">
            Local preview — nothing was sent.
          </p>
        )}
        {matterId && !isDemo && (
          <Link
            href={`/matters/${matterId}`}
            className={`${buttonVariants({ variant: "secondary", size: "sm" })} mt-4`}
          >
            Open the matter
          </Link>
        )}
      </Card>
    );
  }

  if (matters.length === 0) {
    return (
      <Card raised className="p-6">
        <h3 className="flex items-center gap-2 font-medium text-foreground">
          <FolderKanban className="h-4 w-4 text-accent" aria-hidden="true" />
          Work with {lawyerName}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Sharing happens through a matter — it carries your situation,
          documents, and a private message thread. Create one first, then
          come back here.
        </p>
        <Link
          href="/matters/new"
          className={`${buttonVariants({ size: "sm" })} mt-4`}
        >
          Start a matter
        </Link>
      </Card>
    );
  }

  return (
    <Card raised className="p-6">
      <h3 className="font-serif text-xl font-medium tracking-tight text-foreground">
        Work with {lawyerName}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Share a matter — they&rsquo;ll see its brief, documents, and thread,
        and nothing else of yours.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Matter to share" htmlFor="req-matter">
          <Select
            id="req-matter"
            value={matterId}
            onChange={(e) => setMatterId(e.target.value)}
          >
            {matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Introduction (optional)" htmlFor="req-intro">
          <Textarea
            id="req-intro"
            rows={3}
            value={intro}
            onChange={(e) => setIntro(e.target.value.slice(0, 2000))}
            placeholder={`A line or two for ${lawyerName} — what you need and when…`}
          />
        </Field>

        <Button type="submit" disabled={!matterId || busy} className="w-full">
          <Send className="h-4 w-4" aria-hidden="true" />
          {busy ? "Sending…" : "Send request"}
        </Button>
        <p className="text-[11px] leading-relaxed text-muted">
          {ATTORNEY_CLIENT_NOTICE} Representation begins only if{" "}
          {lawyerName} takes you on.
        </p>
      </form>
    </Card>
  );
}

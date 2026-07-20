import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, GitCompareArrows, PenLine } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { getClientMatterDetail } from "@/lib/clients/queries";
import { isIntakeBriefAnnotations } from "@/lib/intake/types";
import { isRedlineAnnotations } from "@/lib/drafting/types";
import { categoryLabel } from "@/lib/matters/categories";
import { IntakeBriefView } from "@/components/clients/intake-brief-view";
import { MessageThread } from "@/components/clients/message-thread";
import { RequestResponseBar } from "@/components/clients/request-response-bar";
import { DeadlineTimeline } from "@/components/matters/deadline-timeline";
import { MatterStatusBadge } from "@/components/matters/status-badge";
import { JurisdictionIndicator } from "@/components/compliance/jurisdiction-indicator";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Client matter" };

/**
 * Lawyer case view (Phase 8): brief-first. RLS grants access via the
 * lawyer_client_links row — no ownership filter, and no AI chat here (the
 * consumer's assistant thread belongs to the client; the lawyer gets the
 * human thread plus documents and deadlines).
 */
export default async function ClientMatterPage({
  params,
}: {
  params: Promise<{ matterId: string }>;
}) {
  const [{ matterId }, viewer] = await Promise.all([params, getViewer()]);
  if (!viewer.user) return null; // (app) layout redirects
  if (viewer.profile?.role !== "lawyer" && !viewer.isDemo) {
    redirect("/dashboard");
  }

  const detail = await getClientMatterDetail(matterId);
  if (!detail) notFound();
  const {
    matter,
    clientName,
    clientId,
    linkStatus,
    briefDocument,
    documents,
    deadlines,
    messages,
  } = detail;

  const brief = isIntakeBriefAnnotations(briefDocument?.ai_annotations)
    ? briefDocument.ai_annotations
    : null;

  return (
    <div className="space-y-6">
      <header className="animate-fade-in-up">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Clients
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-serif text-2xl font-medium leading-snug tracking-tight text-foreground sm:text-3xl">
                {matter.title}
              </h1>
              <MatterStatusBadge status={matter.status} />
            </div>
            <p className="mt-2 text-sm text-muted">
              {clientName} · {categoryLabel(matter.category)}
            </p>
          </div>
          <JurisdictionIndicator
            jurisdiction={{
              country: matter.jurisdiction_country,
              state: matter.jurisdiction_state,
            }}
          />
        </div>
      </header>

      {linkStatus === "invited" && (
        <RequestResponseBar
          matterId={matter.id}
          clientId={clientId}
          clientName={clientName}
          isDemo={viewer.isDemo}
        />
      )}

      {brief ? (
        <IntakeBriefView brief={brief} intake={brief.intake} />
      ) : (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-muted">
            This matter was shared without an intake brief — the client
            connected it directly. The documents and thread below carry the
            context.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <MessageThread
            matterId={matter.id}
            messages={messages}
            viewerId={viewer.user.id}
            counterpartName={clientName}
            isDemo={viewer.isDemo}
          />
        </div>

        <div className="space-y-6">
          <section aria-label="Deadlines">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Deadlines
            </h2>
            <DeadlineTimeline matterId={matter.id} deadlines={deadlines} />
          </section>

          <section aria-label="Documents">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Documents
            </h2>
            {documents.length === 0 ? (
              <Card className="p-4">
                <p className="text-sm leading-relaxed text-muted">
                  Nothing shared yet. Documents the client uploads to this
                  matter appear here.
                </p>
              </Card>
            ) : (
              <ul className="space-y-2">
                {documents.map((d) => {
                  const isRedline = isRedlineAnnotations(d.ai_annotations);
                  const Icon =
                    d.type === "generated"
                      ? isRedline
                        ? GitCompareArrows
                        : PenLine
                      : FileText;
                  return (
                    <li key={d.id}>
                      <Link href={`/documents/${d.id}`} className="group block">
                        <Card className="flex items-center gap-3 p-3.5 transition-colors duration-150 hover:border-accent">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                            <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {d.title ?? "Document"}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {new Date(d.created_at).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

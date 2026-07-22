import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Pencil, Plus, ShieldAlert } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { getMatterDetail, isGeneralMatter } from "@/lib/matters/queries";
import { listDocuments } from "@/lib/documents/queries";
import { getMatterShare } from "@/lib/clients/queries";
import type { DocumentAnalysis } from "@/lib/documents/analysis-types";
import { isRedlineAnnotations } from "@/lib/drafting/types";
import { MessageThread } from "@/components/clients/message-thread";
import { categoryLabel } from "@/lib/matters/categories";
import { ChatScreen } from "@/components/chat/chat-screen";
import { DeadlineTimeline } from "@/components/matters/deadline-timeline";
import { MatterStatusBadge } from "@/components/matters/status-badge";
import { JurisdictionIndicator } from "@/components/compliance/jurisdiction-indicator";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Matter" };

/**
 * Matter workspace (Part 4.1): the conversation, timeline/deadlines, and
 * (from Phase 5) documents for one legal situation. Chat here is scoped to
 * the matter — its jurisdiction and title travel into the AI context.
 */
export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, viewer] = await Promise.all([params, getViewer()]);
  if (!viewer.user) return null; // (app) layout redirects

  const detail = await getMatterDetail(viewer.user.id, id);
  if (!detail) notFound();
  const { matter, deadlines, messages } = detail;
  const [documents, share] = await Promise.all([
    listDocuments(matter.id),
    getMatterShare(matter.id),
  ]);

  const jurisdiction = {
    country: matter.jurisdiction_country,
    state: matter.jurisdiction_state,
  };
  const firstName =
    (viewer.profile?.full_name ?? "").trim().split(" ")[0] || null;

  return (
    <div className="space-y-6">
      <header className="animate-fade-in-up">
        <Link
          href="/matters"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Matters
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {categoryLabel(matter.category)}
            </p>
            <h1 className="mt-1 font-serif text-2xl font-medium leading-snug tracking-tight text-foreground sm:text-3xl">
              {matter.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <MatterStatusBadge status={matter.status} />
              <JurisdictionIndicator jurisdiction={jurisdiction} />
            </div>
          </div>
          {!isGeneralMatter(matter) && (
            <Link
              href={`/matters/${matter.id}/edit`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Conversation — scoped to this matter */}
        <section aria-label="Matter conversation" className="min-w-0">
          <ChatScreen
            initialMessages={messages}
            jurisdiction={jurisdiction}
            firstName={firstName}
            matterId={matter.id}
            matterTitle={matter.title}
            className="h-[max(560px,calc(100dvh-21rem))]"
          />
        </section>

        {/* Timeline + documents */}
        <div className="space-y-6">
          {/* Lawyer thread (Phase 8) — only when the matter is shared. */}
          {share && viewer.user && (
            <section aria-label="Messages with your lawyer">
              {share.status === "invited" && (
                <p className="mb-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs leading-relaxed text-muted">
                  Your request is with{" "}
                  <span className="font-medium text-foreground">
                    {share.lawyerName}
                  </span>{" "}
                  — they can already see this matter and reply here.
                </p>
              )}
              <MessageThread
                matterId={matter.id}
                messages={share.messages}
                viewerId={viewer.user.id}
                counterpartName={share.lawyerName}
                isDemo={viewer.isDemo}
              />
            </section>
          )}

          <section aria-label="Timeline and deadlines">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Timeline &amp; deadlines
            </h2>
            <DeadlineTimeline matterId={matter.id} deadlines={deadlines} />
          </section>

          <section aria-label="Documents">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Documents
              </h2>
              <span className="flex items-center gap-3">
                <Link
                  href={`/documents?matter=${matter.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors duration-150 hover:opacity-80"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Analyze
                </Link>
                <Link
                  href={`/documents/generate?matter=${matter.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors duration-150 hover:opacity-80"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Generate
                </Link>
              </span>
            </div>
            {documents.length === 0 ? (
              <Card className="flex items-start gap-3 border-dashed p-4">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-muted">
                  Upload a contract or notice for this matter and Justice will
                  explain it clause by clause.
                </p>
              </Card>
            ) : (
              <ul className="space-y-2.5">
                {documents.map((d) => {
                  const analysis =
                    d.type === "uploaded"
                      ? (d.ai_annotations as unknown as DocumentAnalysis | null)
                      : null;
                  const risks = analysis?.risky_or_unusual_clauses?.length ?? 0;
                  return (
                    <li key={d.id}>
                      <Link href={`/documents/${d.id}`} className="group block">
                        <Card className="flex items-center gap-3 p-3.5 transition-colors duration-150 hover:border-accent">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                            <FileText className="h-4 w-4 text-accent" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {d.title ?? "Document"}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {d.type === "generated"
                                ? isRedlineAnnotations(d.ai_annotations)
                                  ? "Revised draft"
                                  : "Generated draft"
                                : analysis?.document_type}
                            </p>
                          </div>
                          {risks > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-alert">
                              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                              {risks}
                            </span>
                          )}
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

import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, FileText, GitCompareArrows, PenLine, ShieldAlert } from "lucide-react";
import { isRedlineAnnotations } from "@/lib/drafting/types";
import { isIntakeBriefAnnotations } from "@/lib/intake/types";
import { getViewer } from "@/lib/auth/session";
import { getViewerTier } from "@/lib/billing/gate";
import { LockedPanel } from "@/components/billing/locked-panel";
import { listMatters } from "@/lib/matters/queries";
import { listDocuments, type DocumentListItem } from "@/lib/documents/queries";
import { GENERAL_CATEGORY } from "@/lib/matters/categories";
import {
  UploadAnalyze,
  type MatterOption,
} from "@/components/documents/upload-analyze";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { DocumentAnalysis } from "@/lib/documents/analysis-types";

export const metadata: Metadata = { title: "Documents" };

/**
 * Document Intelligence home (Phase 5): upload/analyze + the library of
 * analyzed documents across matters.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ matter?: string }>;
}) {
  const [{ matter: preselect }, viewer] = await Promise.all([
    searchParams,
    getViewer(),
  ]);
  if (!viewer.user) return null; // (app) layout redirects

  const [matters, documents] = await Promise.all([
    listMatters(viewer.user.id),
    listDocuments(),
  ]);

  const matterOptions: MatterOption[] = matters
    .filter((m) => m.category !== GENERAL_CATEGORY)
    .map((m) => ({
      id: m.id,
      title: m.title,
      country: m.jurisdiction_country,
      state: m.jurisdiction_state,
    }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
        <div>
          <p className="text-sm text-muted">Understand before you sign</p>
          <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-foreground">
            Documents
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Upload a contract, notice, or court paper. LexMind reads it and
            shows you the obligations, deadlines, and risky clauses — each one
            linked to the exact text it comes from.
          </p>
        </div>
        <Link
          href="/documents/generate"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <PenLine className="h-4 w-4" aria-hidden="true" />
          Generate a document
        </Link>
      </header>

      {(await getViewerTier(viewer)) === "free" ? (
        <LockedPanel
          title="Document Intelligence"
          body="Upload a contract, notice, or court paper and see the obligations, deadlines, and risky clauses — each linked to the exact text it comes from."
          tier={viewer.profile?.role === "lawyer" ? "professional" : "plus"}
        />
      ) : (
        <UploadAnalyze
          matters={matterOptions}
          preselectedMatterId={
            matterOptions.some((m) => m.id === preselect) ? preselect : undefined
          }
          viewerJurisdiction={{
            country: viewer.profile?.country ?? null,
            state: viewer.profile?.state_province ?? null,
          }}
          isDemo={viewer.isDemo}
        />
      )}

      {documents.length > 0 && (
        <section aria-label="Analyzed documents">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Your documents
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {documents.map((d) => (
              <li key={d.id}>
                <DocumentCard doc={d} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DocumentCard({ doc }: { doc: DocumentListItem }) {
  const isGenerated = doc.type === "generated";
  const isRedline = isRedlineAnnotations(doc.ai_annotations);
  const isBrief = isIntakeBriefAnnotations(doc.ai_annotations);
  const analysis = isGenerated
    ? null
    : (doc.ai_annotations as unknown as DocumentAnalysis | null);
  const riskCount = analysis?.risky_or_unusual_clauses?.length ?? 0;
  const highRisk = analysis?.risky_or_unusual_clauses?.some(
    (r) => r.severity === "high",
  );

  return (
    <Link href={`/documents/${doc.id}`} className="group block h-full">
      <Card className="flex h-full flex-col p-5 transition-colors duration-150 hover:border-accent">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
            {isBrief ? (
              <ClipboardList className="h-5 w-5 text-accent" aria-hidden="true" />
            ) : isRedline ? (
              <GitCompareArrows className="h-5 w-5 text-accent" aria-hidden="true" />
            ) : isGenerated ? (
              <PenLine className="h-5 w-5 text-accent" aria-hidden="true" />
            ) : (
              <FileText className="h-5 w-5 text-accent" aria-hidden="true" />
            )}
          </span>
          {isGenerated ? (
            <Badge tone="accent">
              {isRedline ? "Redline" : isBrief ? "Case brief" : "Draft"}
            </Badge>
          ) : (
            riskCount > 0 && (
              <Badge tone={highRisk ? "alert" : "accent"}>
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                {riskCount} flagged clause{riskCount === 1 ? "" : "s"}
              </Badge>
            )
          )}
        </div>
        <h3 className="mt-3 font-serif text-lg font-medium leading-snug tracking-tight text-foreground">
          {doc.title ?? "Document"}
        </h3>
        {isGenerated ? (
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
            {isRedline
              ? "Revised draft — every change logged"
              : isBrief
                ? "Structured brief from client intake"
                : "Generated draft — review before use"}
          </p>
        ) : (
          analysis && (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
              {analysis.document_type}
            </p>
          )
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-muted">
          <span className="truncate">{doc.matterTitle ?? "Unfiled"}</span>
          <span className="shrink-0">
            {new Date(doc.created_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </Card>
    </Link>
  );
}

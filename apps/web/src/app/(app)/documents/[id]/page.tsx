import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { getDocumentDetail } from "@/lib/documents/queries";
import { isGeneratedAnnotations } from "@/lib/generation/types";
import {
  isLawyerDraftAnnotations,
  isRedlineAnnotations,
} from "@/lib/drafting/types";
import { isIntakeBriefAnnotations } from "@/lib/intake/types";
import { IntakeBriefView } from "@/components/clients/intake-brief-view";
import { AnalysisView } from "@/components/documents/analysis-view";
import { GeneratedDocView } from "@/components/documents/generated-doc-view";
import { RedlineDocView } from "@/components/documents/redline-doc-view";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Document analysis" };

/** The persisted home of one analyzed document — the signature screen. */
export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, viewer] = await Promise.all([params, getViewer()]);
  if (!viewer.user) return null; // (app) layout redirects

  const doc = await getDocumentDetail(id);
  if (!doc) notFound();
  // Three draft kinds share documents.type='generated' (Phase 6 + Phase 7):
  // consumer generation, lawyer drafts (same shape), and redlines.
  const generated =
    isGeneratedAnnotations(doc.ai_annotations) ||
    isLawyerDraftAnnotations(doc.ai_annotations)
      ? doc.ai_annotations
      : null;
  const redline = isRedlineAnnotations(doc.ai_annotations)
    ? doc.ai_annotations
    : null;
  const brief = isIntakeBriefAnnotations(doc.ai_annotations)
    ? doc.ai_annotations
    : null;

  return (
    <div className="space-y-6">
      <header className="animate-fade-in-up">
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Documents
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-serif text-2xl font-medium leading-snug tracking-tight text-foreground sm:text-3xl">
                {doc.title ?? "Document"}
              </h1>
              {doc.type === "generated" && (
                <Badge tone="accent">
                  {redline ? "Redline" : brief ? "Case brief" : "Draft"}
                </Badge>
              )}
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {doc.matterTitle && (
                <Link
                  href={`/matters/${doc.matter_id}`}
                  className="inline-flex items-center gap-1.5 font-medium text-muted-strong transition-colors duration-150 hover:text-foreground"
                >
                  <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
                  {doc.matterTitle}
                </Link>
              )}
              <span>
                Analyzed{" "}
                {new Date(doc.created_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </p>
          </div>
          <DeleteDocumentButton documentId={doc.id} matterId={doc.matter_id} />
        </div>
      </header>

      {brief ? (
        <IntakeBriefView brief={brief} intake={brief.intake} />
      ) : redline ? (
        <RedlineDocView redline={redline} />
      ) : generated ? (
        <GeneratedDocView generated={generated} />
      ) : doc.analysis ? (
        <AnalysisView
          analysis={doc.analysis}
          jurisdiction={doc.matterJurisdiction}
          matterId={doc.matter_id}
          canAddDeadlines={!viewer.isDemo}
        />
      ) : (
        <Alert tone="info" title="No analysis stored">
          This document was saved without an analysis. Upload it again from the
          Documents page to analyze it.
        </Alert>
      )}
    </div>
  );
}

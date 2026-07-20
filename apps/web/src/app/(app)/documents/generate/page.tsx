import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { listMatters } from "@/lib/matters/queries";
import { GENERAL_CATEGORY } from "@/lib/matters/categories";
import { GenerateWizard } from "@/components/generation/generate-wizard";
import type { MatterOption } from "@/components/documents/upload-analyze";

export const metadata: Metadata = { title: "Generate a document" };

/** Document Generation wizard (Phase 6). */
export default async function GenerateDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ matter?: string }>;
}) {
  const [{ matter: preselect }, viewer] = await Promise.all([
    searchParams,
    getViewer(),
  ]);
  if (!viewer.user) return null; // (app) layout redirects

  const matters = await listMatters(viewer.user.id);
  const matterOptions: MatterOption[] = matters
    .filter((m) => m.category !== GENERAL_CATEGORY)
    .map((m) => ({
      id: m.id,
      title: m.title,
      country: m.jurisdiction_country,
      state: m.jurisdiction_state,
    }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Documents
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight text-foreground">
          Generate a document
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          A careful first draft from your facts — with placeholders where
          information is missing and flags on every judgment call. Review
          before use, always.
        </p>
      </div>

      <GenerateWizard
        matters={matterOptions}
        preselectedMatterId={
          matterOptions.some((m) => m.id === preselect) ? preselect : undefined
        }
      />
    </div>
  );
}

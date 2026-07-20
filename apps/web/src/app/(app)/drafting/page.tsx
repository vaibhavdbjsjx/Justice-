import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { getViewerTier } from "@/lib/billing/gate";
import { LockedPanel } from "@/components/billing/locked-panel";
import { JurisdictionIndicator } from "@/components/compliance/jurisdiction-indicator";
import { DraftingWorkspace } from "@/components/drafting/drafting-workspace";

export const metadata: Metadata = { title: "Drafting" };

/**
 * Lawyer drafting assistant (Phase 7, Part 4.3). Role-gated: legal
 * professionals only (demo mode previews it). Drafts and redlines persist
 * into the lawyer's research workspace matter via the API routes.
 */
export default async function DraftingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ mode }, viewer] = await Promise.all([searchParams, getViewer()]);
  if (!viewer.user) return null; // (app) layout redirects
  if (viewer.profile?.role !== "lawyer" && !viewer.isDemo) {
    redirect("/dashboard");
  }
  if ((await getViewerTier(viewer)) !== "professional") {
    return (
      <LockedPanel
        title="Drafting assistant"
        body="First drafts and redlines with professional discipline — nothing invented, every judgment call flagged, every change accounted for."
        tier="professional"
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-in-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">You stay in control</p>
            <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-foreground">
              Drafting assistant
            </h1>
          </div>
          <JurisdictionIndicator
            jurisdiction={{
              country: viewer.profile?.country ?? null,
              state: viewer.profile?.state_province ?? null,
            }}
          />
        </div>
        <p className="mt-2 max-w-2xl text-muted">
          First drafts and redlines with professional discipline: nothing
          invented, every judgment call flagged, every change accounted for.
        </p>
      </header>

      <DraftingWorkspace
        initialMode={mode === "redline" ? "redline" : "draft"}
      />
    </div>
  );
}

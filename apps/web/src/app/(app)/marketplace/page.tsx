import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, Clock, ShieldAlert } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { getViewerTier } from "@/lib/billing/gate";
import { LockedPanel } from "@/components/billing/locked-panel";
import { getOwnLawyerProfile, normalizeJsonStrings } from "@/lib/lawyers/queries";
import { LawyerProfileEditor } from "@/components/marketplace/lawyer-profile-editor";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Marketplace profile" };

/**
 * Lawyer marketplace presence (Phase 9, Part 4.3). Verification is a
 * real-world review (Part 12): the status is displayed, never editable —
 * column grants make that true at the database, not just the UI.
 */
export default async function MarketplacePage() {
  const viewer = await getViewer();
  if (!viewer.user) return null; // (app) layout redirects
  if (viewer.profile?.role !== "lawyer" && !viewer.isDemo) {
    redirect("/dashboard");
  }
  if ((await getViewerTier(viewer)) !== "professional") {
    return (
      <LockedPanel
        title="Marketplace profile"
        body="Be discoverable by consumers who need your practice areas and jurisdiction — verification confirmed by Justice, requests arriving as structured briefs."
        tier="professional"
      />
    );
  }

  const profile = await getOwnLawyerProfile();
  const status = profile?.verification_status ?? "pending";

  return (
    <div className="space-y-6">
      <header className="animate-fade-in-up">
        <p className="text-sm text-muted">Be found by the right clients</p>
        <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-foreground">
          Marketplace profile
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Consumers searching &ldquo;Find a lawyer&rdquo; see the card you
          shape here. Verification is confirmed by Justice before your
          profile is listed.
        </p>
      </header>

      {status === "verified" ? (
        <Alert tone="success" title="Verified">
          <span className="inline-flex items-center gap-1.5">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            Your bar enrollment is confirmed — your profile is live in the
            directory.
          </span>
        </Alert>
      ) : status === "rejected" ? (
        <Alert tone="error" title="Verification unsuccessful">
          <span className="inline-flex items-start gap-1.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            We couldn&rsquo;t confirm your enrollment with the details
            provided. Check your bar number below and save again, and we&rsquo;ll
            re-review.
          </span>
        </Alert>
      ) : (
        <Alert tone="info" title="Verification in review">
          <span className="inline-flex items-start gap-1.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            We confirm bar enrollment before listing anyone. Your profile
            isn&rsquo;t discoverable yet — finish it now so it goes live the
            moment review completes.
          </span>
        </Alert>
      )}

      <LawyerProfileEditor
        initial={{
          bio: profile?.bio ?? "",
          practiceAreas: normalizeJsonStrings(profile?.practice_areas),
          licensedJurisdictions: normalizeJsonStrings(
            profile?.licensed_jurisdictions,
          ),
          barNumber: profile?.bar_number ?? "",
          rateRange: profile?.rate_range ?? "",
        }}
        viewerName={viewer.profile?.full_name?.trim() || "Your name"}
        verified={status === "verified"}
      />
    </div>
  );
}

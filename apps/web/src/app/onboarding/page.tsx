import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set up your account" };

export default async function OnboardingPage() {
  const viewer = await getViewer();

  if (!viewer.user) redirect("/sign-in");
  // Already onboarded → straight to the app (skip in preview so it's viewable).
  if (!viewer.isDemo && viewer.profile?.onboarding_completed) redirect("/dashboard");

  return (
    <Card raised className="p-6 sm:p-8">
      {viewer.isDemo && (
        <Alert tone="info" className="mb-6">
          Preview mode — connect Supabase to save your onboarding. Finishing here
          just opens the dashboard preview.
        </Alert>
      )}
      <OnboardingWizard isDemo={viewer.isDemo} initialFullName={viewer.profile?.full_name ?? ""} />
    </Card>
  );
}

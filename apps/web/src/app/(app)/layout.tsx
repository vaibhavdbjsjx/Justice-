import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { needsAiConsent } from "@/lib/ai/consent";
import { getViewer } from "@/lib/auth/session";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  if (!viewer.user) redirect("/sign-in");
  if (!viewer.isDemo && !viewer.profile?.onboarding_completed) redirect("/onboarding");
  // Ask once before anyone reaches the AI tools. "Not now" defers the question
  // for a day; the AI routes themselves refuse until permission is given.
  if (
    !viewer.isDemo &&
    viewer.profile &&
    needsAiConsent(viewer.profile) &&
    !(await cookies()).has("lexa_ai_consent_deferred")
  ) {
    redirect("/consent");
  }

  const p = viewer.profile;
  return (
    <AppShell
      isDemo={viewer.isDemo}
      viewer={{
        fullName: p?.full_name ?? null,
        email: viewer.user.email,
        role: p?.role ?? "consumer",
        country: p?.country ?? null,
        stateProvince: p?.state_province ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}

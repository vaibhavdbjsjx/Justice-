import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  if (!viewer.user) redirect("/sign-in");
  if (!viewer.isDemo && !viewer.profile?.onboarding_completed) redirect("/onboarding");

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

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { getViewer } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const viewer = await getViewer();
  const { error, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);
  if (viewer.user && !viewer.isDemo) redirect(next ?? "/dashboard");

  return (
    <Card raised className="p-6 sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Sign in to pick up where you left off.
        </p>
      </div>

      {error && (
        <Alert tone="error" className="mb-4">
          We couldn&rsquo;t complete that sign-in. Please try again.
        </Alert>
      )}

      <OAuthButtons next={next} />
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <AuthForm mode="sign-in" next={next} />

      <p className="mt-6 text-center text-sm text-muted">
        New to LexMind?{" "}
        <Link
          href={next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </Card>
  );
}

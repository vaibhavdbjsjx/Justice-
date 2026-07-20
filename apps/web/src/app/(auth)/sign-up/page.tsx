import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Card } from "@/components/ui/card";
import { getViewer } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next: rawNext }, viewer] = await Promise.all([
    searchParams,
    getViewer(),
  ]);
  const next = safeNextPath(rawNext);
  if (viewer.user && !viewer.isDemo) redirect(next ?? "/dashboard");

  return (
    <Card raised className="p-6 sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Understand your legal situation in minutes — free to start.
        </p>
      </div>

      <OAuthButtons next={next} />
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <AuthForm mode="sign-up" next={next} />

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </Card>
  );
}

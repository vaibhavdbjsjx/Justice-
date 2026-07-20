"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Branded runtime error boundary (Phase 13 polish). Next's default error
 * screen is unstyled and alarming; this keeps the calm, professional tone
 * (Part 8) and offers a retry. Errors in the root layout are not caught here
 * (that needs global-error), but every page-level throw is.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for observability; never shown raw to the user.
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
        <Scale className="h-7 w-7 text-accent" aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-serif text-3xl font-medium tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        An unexpected error interrupted that page. Nothing you&rsquo;ve saved is
        affected — your matters, documents, and conversations are safe.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          Go to your dashboard
        </Link>
      </div>
    </main>
  );
}

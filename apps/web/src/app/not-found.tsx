import type { Metadata } from "next";
import Link from "next/link";
import { Scale } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Branded 404 (Phase 13 polish) — Next's default is unstyled and breaks the
 * premium feel (Part 5). Self-contained (no app shell) so it renders for both
 * marketing and in-app not-found cases.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
        <Scale className="h-7 w-7 text-accent" aria-hidden="true" />
      </span>
      <p className="mt-6 font-mono text-sm font-medium uppercase tracking-widest text-muted">
        404
      </p>
      <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        We couldn&rsquo;t find that page
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        The page may have moved, or the link may be out of date. Your matters,
        documents, and conversations are safe.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
          Go to your dashboard
        </Link>
        <Link
          href="/"
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}

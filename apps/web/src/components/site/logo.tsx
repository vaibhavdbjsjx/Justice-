import Link from "next/link";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

/** LexMind wordmark — serif for gravitas, gold scale mark used sparingly. */
export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-serif text-lg font-medium tracking-tight text-foreground",
        className,
      )}
      aria-label="LexMind home"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Scale className="h-4 w-4 text-accent" aria-hidden="true" />
      </span>
      LexMind
    </Link>
  );
}

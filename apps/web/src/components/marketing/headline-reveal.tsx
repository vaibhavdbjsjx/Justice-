import { cn } from "@/lib/utils";

/**
 * Words that rise into place through a touch of depth. CSS only, so it runs before
 * hydration and never delays the headline, and reduced motion shows it at rest.
 */
export function HeadlineReveal({
  text,
  delay = 60,
  emphasis = false,
}: {
  text: string;
  delay?: number;
  emphasis?: boolean;
}) {
  const words = text.split(" ");
  return (
    <span aria-label={text} className="[perspective:600px]">
      {words.map((word, i) => (
        <span key={`${word}-${i}`} aria-hidden="true">
          <span
            className={cn(
              "animate-word-rise inline-block",
              emphasis && "text-brand-gradient",
            )}
            style={{ animationDelay: `${delay + i * 70}ms` }}
          >
            {word}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

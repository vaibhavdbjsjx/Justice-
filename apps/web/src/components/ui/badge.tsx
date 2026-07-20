import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "alert" | "navy";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-muted-strong border-border",
  accent: "bg-accent-soft text-[color-mix(in_srgb,var(--accent)_80%,var(--foreground))] border-transparent",
  success: "bg-success-soft text-success border-transparent",
  alert: "bg-alert-soft text-alert border-transparent",
  navy: "bg-primary text-primary-foreground border-transparent",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "error" | "success";

const meta: Record<Tone, { Icon: typeof Info; wrap: string; icon: string }> = {
  info: { Icon: Info, wrap: "border-border bg-surface-sunken", icon: "text-accent" },
  error: { Icon: CircleAlert, wrap: "border-alert/30 bg-alert-soft", icon: "text-alert" },
  success: { Icon: CircleCheck, wrap: "border-success/30 bg-success-soft", icon: "text-success" },
};

/** Inline form/status message. Composed, professional tone (Part 8 error UX). */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { Icon, wrap, icon } = meta[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm", wrap, className)}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", icon)} aria-hidden="true" />
      <div className="space-y-0.5">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className="text-muted-strong">{children}</div>}
      </div>
    </div>
  );
}

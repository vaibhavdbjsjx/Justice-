import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[90px] w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-foreground",
      "placeholder:text-muted transition-colors duration-150",
      "focus-visible:border-accent focus-visible:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-[invalid=true]:border-alert",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

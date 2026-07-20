import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Large selectable option card (role selection, plan choice, etc.). */
export function RadioCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  className,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors duration-150",
        "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-accent bg-accent-soft ring-1 ring-accent/40"
          : "border-border bg-surface hover:border-border-strong",
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
            selected ? "bg-accent text-accent-foreground" : "bg-surface-sunken text-muted",
          )}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
          selected ? "border-accent bg-accent text-accent-foreground" : "border-border-strong",
        )}
        aria-hidden="true"
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

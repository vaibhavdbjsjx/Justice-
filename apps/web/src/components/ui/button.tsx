import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "accent"
  | "secondary"
  | "ghost"
  | "subtle"
  | "destructive"
  | "link";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium " +
  "transition-colors duration-150 ease-[var(--ease-refined)] " +
  "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover shadow-[var(--shadow-sm)]",
  accent:
    "bg-accent text-accent-foreground hover:bg-accent-hover shadow-[var(--shadow-sm)]",
  secondary:
    "bg-surface text-foreground border border-border-strong hover:bg-surface-sunken",
  ghost: "text-foreground hover:bg-accent-soft",
  subtle: "bg-accent-soft text-foreground hover:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)]",
  destructive: "bg-alert text-white hover:opacity-90 shadow-[var(--shadow-sm)]",
  link: "text-accent underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[variant === "link" ? "sm" : size], variant === "link" && "h-auto px-0", className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonVariants({ variant, size, className })}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

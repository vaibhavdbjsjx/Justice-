"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { JurisdictionIndicator } from "@/components/compliance/jurisdiction-indicator";
import { navForRole } from "./nav-items";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/supabase/types";

export type ShellViewer = {
  fullName: string | null;
  email: string | null;
  role: UserRole;
  country: string | null;
  stateProvince: string | null;
};

export function AppShell({
  viewer,
  isDemo,
  children,
}: {
  viewer: ShellViewer;
  isDemo?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = navForRole(viewer.role);

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-4">
      <div className="px-2 py-2">
        <Logo href="/dashboard" />
      </div>
      <nav className="mt-2 flex-1 space-y-1" aria-label="Primary">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          const base =
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150";
          if (item.soon) {
            return (
              <div
                key={item.href}
                className={cn(base, "cursor-default text-muted/70")}
                aria-disabled="true"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Soon
                </span>
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                base,
                active
                  ? "bg-accent-soft text-foreground"
                  : "text-muted-strong hover:bg-surface-sunken hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-accent")} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="mt-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {(viewer.fullName ?? viewer.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {viewer.fullName ?? "Your account"}
            </p>
            <p className="truncate text-xs text-muted">{viewer.email}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <Badge tone={viewer.role === "lawyer" ? "navy" : "neutral"}>
            {viewer.role === "lawyer" ? "Lawyer" : "Consumer"}
          </Badge>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-[264px] shrink-0 border-r border-border bg-background lg:block">
        <div className="sticky top-0 h-dvh">{sidebar}</div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-overlay"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[280px] border-r border-border bg-background shadow-[var(--shadow-lg)]">
            <button
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 rounded-md p-1.5 text-muted hover:bg-surface-sunken"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 text-muted hover:bg-surface-sunken lg:hidden"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <JurisdictionIndicator
              jurisdiction={{ country: viewer.country, state: viewer.stateProvince }}
            />
          </div>
          <div className="flex items-center gap-2">
            {isDemo && (
              <Badge tone="accent" className="hidden sm:inline-flex">
                Preview
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

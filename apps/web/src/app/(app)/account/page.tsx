import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteAccount } from "@/components/account/delete-account";
import { formatJurisdiction } from "@/lib/legal/jurisdiction";
import { languageName } from "@/lib/i18n/languages";
import type { UserRole } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const viewer = await getViewer();
  const p = viewer.profile;
  const role: UserRole = p?.role ?? "consumer";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="animate-fade-in-up">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground">
          Account
        </h1>
        <p className="mt-2 text-muted">Manage your profile, data, and account.</p>
      </header>

      {/* Profile summary */}
      <Card className="p-5">
        <dl className="divide-y divide-border">
          <Row label="Name" value={p?.full_name || "—"} />
          <Row label="Email" value={viewer.user?.email || "—"} />
          <Row
            label="Role"
            value={role === "lawyer" ? "Legal professional" : "Consumer"}
          />
          <Row
            label="Jurisdiction"
            value={formatJurisdiction({
              country: p?.country ?? null,
              state: p?.state_province ?? null,
            })}
          />
          <Row label="Language" value={languageName(p?.preferred_language)} />
        </dl>
      </Card>

      {/* Sign out */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h3 className="font-medium text-foreground">Sign out</h3>
          <p className="mt-0.5 text-sm text-muted">
            Sign out of Justice on this device.
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-surface-sunken"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </Card>

      {/* Legal & support */}
      <Card className="p-5">
        <h3 className="font-medium text-foreground">Legal &amp; support</h3>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/privacy" className="text-accent underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-accent underline-offset-4 hover:underline">
            Terms of Service
          </Link>
          <Link href="/disclaimer" className="text-accent underline-offset-4 hover:underline">
            Legal Disclaimer
          </Link>
          <Link href="/contact" className="text-accent underline-offset-4 hover:underline">
            Support
          </Link>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Badge tone="neutral">Reminder</Badge>
          Justice provides legal information, not legal advice.
        </p>
      </Card>

      {/* Danger zone */}
      <DeleteAccount isDemo={viewer.isDemo} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

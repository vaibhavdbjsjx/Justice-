import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { MatterForm } from "@/components/matters/matter-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "New matter" };

export default async function NewMatterPage() {
  const viewer = await getViewer();
  const p = viewer.profile;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/matters"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Matters
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight text-foreground">
          Start a matter
        </h1>
        <p className="mt-2 text-muted">
          One place for this situation — its conversation, documents, and
          deadlines.
        </p>
      </div>

      <Card className="p-6">
        <MatterForm
          mode="create"
          defaultCountry={p?.country ?? null}
          defaultState={p?.state_province ?? null}
        />
      </Card>
    </div>
  );
}

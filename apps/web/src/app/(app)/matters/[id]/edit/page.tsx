import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { getMatterDetail } from "@/lib/matters/queries";
import { MatterForm } from "@/components/matters/matter-form";
import { DeleteMatterButton } from "@/components/matters/delete-matter-button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Edit matter" };

export default async function EditMatterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, viewer] = await Promise.all([params, getViewer()]);
  if (!viewer.user) return null; // (app) layout redirects

  const detail = await getMatterDetail(viewer.user.id, id);
  if (!detail) notFound();
  const { matter } = detail;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href={`/matters/${matter.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {matter.title}
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight text-foreground">
          Edit matter
        </h1>
      </div>

      <Card className="p-6">
        <MatterForm
          mode="edit"
          matter={matter}
          defaultCountry={viewer.profile?.country ?? null}
          defaultState={viewer.profile?.state_province ?? null}
        />
      </Card>

      <section aria-label="Danger zone" className="border-t border-border pt-5">
        <DeleteMatterButton matterId={matter.id} />
      </section>
    </div>
  );
}

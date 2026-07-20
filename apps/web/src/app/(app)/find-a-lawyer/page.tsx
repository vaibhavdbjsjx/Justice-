import type { Metadata } from "next";
import { Search, Users } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { listVerifiedLawyers } from "@/lib/lawyers/queries";
import { PRACTICE_AREAS } from "@/lib/legal/practice-areas";
import { LawyerCard } from "@/components/marketplace/lawyer-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const metadata: Metadata = { title: "Find a lawyer" };

/**
 * Consumer directory of verified lawyers (Phase 9, Part 4.2 — the
 * monetization bridge). Filters run server-side over the RLS-scoped verified
 * set via a plain GET form — no client JS needed to search.
 */
export default async function FindALawyerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; area?: string; where?: string }>;
}) {
  const [{ q = "", area = "", where = "" }, viewer] = await Promise.all([
    searchParams,
    getViewer(),
  ]);
  if (!viewer.user) return null; // (app) layout redirects

  const all = await listVerifiedLawyers();
  const needle = q.trim().toLowerCase();
  const placeNeedle = where.trim().toLowerCase();

  const lawyers = all.filter((l) => {
    if (area && !l.practiceAreas.includes(area)) return false;
    if (
      placeNeedle &&
      !l.licensedJurisdictions.some((j) => j.toLowerCase().includes(placeNeedle)) &&
      !(l.country ?? "").toLowerCase().includes(placeNeedle) &&
      !(l.state ?? "").toLowerCase().includes(placeNeedle)
    ) {
      return false;
    }
    if (needle) {
      const haystack = [l.name, l.bio ?? "", ...l.practiceAreas]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="animate-fade-in-up">
        <p className="text-sm text-muted">Verified professionals only</p>
        <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-foreground">
          Find a lawyer
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Every lawyer here has had their bar enrollment confirmed by LexMind.
          When you find the right fit, share your matter — your documents and
          case brief travel with it.
        </p>
      </header>

      {/* Server-side search — a plain GET form */}
      <form method="get" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_180px_auto]">
        <div>
          <label htmlFor="fal-q" className="sr-only">
            Search by name or expertise
          </label>
          <Input
            id="fal-q"
            name="q"
            defaultValue={q}
            placeholder="Search by name or expertise…"
          />
        </div>
        <div>
          <label htmlFor="fal-area" className="sr-only">
            Practice area
          </label>
          <Select id="fal-area" name="area" defaultValue={area}>
            <option value="">All practice areas</option>
            {PRACTICE_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="fal-where" className="sr-only">
            Jurisdiction
          </label>
          <Input
            id="fal-where"
            name="where"
            defaultValue={where}
            placeholder="State or country…"
          />
        </div>
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" aria-hidden="true" />
          Search
        </Button>
      </form>

      {lawyers.length === 0 ? (
        <Card className="p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft">
            <Users className="h-5 w-5 text-accent" aria-hidden="true" />
          </span>
          <p className="mt-3 font-medium text-foreground">
            No verified lawyers match that search
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">
            Try broadening the practice area or jurisdiction — the directory
            grows as more lawyers complete verification.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lawyers.map((lawyer) => (
            <li key={lawyer.userId}>
              <LawyerCard lawyer={lawyer} href={`/find-a-lawyer/${lawyer.userId}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

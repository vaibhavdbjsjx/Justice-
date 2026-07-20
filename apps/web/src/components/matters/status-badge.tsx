import { Badge } from "@/components/ui/badge";
import type { MatterStatus } from "@/lib/supabase/types";

const meta: Record<MatterStatus, { label: string; tone: "accent" | "success" | "neutral" }> = {
  active: { label: "Active", tone: "accent" },
  resolved: { label: "Resolved", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
};

export function MatterStatusBadge({ status }: { status: MatterStatus }) {
  const { label, tone } = meta[status];
  return <Badge tone={tone}>{label}</Badge>;
}

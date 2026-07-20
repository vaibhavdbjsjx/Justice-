import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  ClientMessage,
  Deadline,
  DocumentRow,
  IntakeLink,
  Matter,
} from "@/lib/supabase/types";

/**
 * Lawyer-side reads (Phase 8). Everything goes through the user-scoped client:
 * RLS is the access check (is_matter_lawyer via lawyer_client_links) — no
 * ownership filters here, unlike lib/matters/queries which serves the OWNER
 * side. Demo mode serves ./demo fixtures.
 */

export type ClientMatterListItem = {
  matter: Matter;
  clientName: string;
  clientId: string;
  linkStatus: string;
  sharedAt: string;
};

export type ClientMatterDetail = ClientMatterListItem & {
  briefDocument: DocumentRow | null;
  documents: DocumentRow[];
  deadlines: Deadline[];
  messages: ClientMessage[];
};

export async function listIntakeLinks(): Promise<IntakeLink[]> {
  if (!isSupabaseConfigured) {
    const { demoIntakeLinks } = await import("./demo");
    return demoIntakeLinks();
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("intake_links")
    .select("*")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

type LinkRow = {
  client_id: string;
  status: string;
  created_at: string;
  matters: Matter | null;
  client: { full_name: string | null } | null;
};

const LINK_SELECT =
  "client_id, status, created_at, matters(*), client:profiles!lawyer_client_links_client_id_fkey(full_name)";

export async function listClientMatters(): Promise<ClientMatterListItem[]> {
  if (!isSupabaseConfigured) {
    const { demoClientMatters } = await import("./demo");
    return demoClientMatters();
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("lawyer_client_links")
    .select(LINK_SELECT)
    .in("status", ["invited", "active"])
    .order("created_at", { ascending: false });

  return ((data as unknown as LinkRow[] | null) ?? []).flatMap((row) =>
    row.matters
      ? [
          {
            matter: row.matters,
            clientName: row.client?.full_name?.trim() || "Client",
            clientId: row.client_id,
            linkStatus: row.status,
            sharedAt: row.created_at,
          },
        ]
      : [],
  );
}

export async function getClientMatterDetail(
  matterId: string,
): Promise<ClientMatterDetail | null> {
  if (!isSupabaseConfigured) {
    const { demoClientMatterDetail } = await import("./demo");
    return demoClientMatterDetail(matterId);
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("lawyer_client_links")
    .select(LINK_SELECT)
    .eq("matter_id", matterId)
    .in("status", ["invited", "active"])
    .maybeSingle();
  const row = data as unknown as LinkRow | null;
  if (!row?.matters) return null;

  const [{ data: documents }, { data: deadlines }, { data: messages }] =
    await Promise.all([
      supabase
        .from("documents")
        .select("*")
        .eq("matter_id", matterId)
        .order("created_at", { ascending: false }),
      supabase
        .from("deadlines")
        .select("*")
        .eq("matter_id", matterId)
        .order("due_date", { ascending: true }),
      supabase
        .from("client_messages")
        .select("*")
        .eq("matter_id", matterId)
        .order("created_at", { ascending: true })
        .limit(300),
    ]);

  const docs = documents ?? [];
  const briefDocument =
    docs.find(
      (d) =>
        (d.ai_annotations as { kind?: string } | null)?.kind === "intake_brief",
    ) ?? null;

  return {
    matter: row.matters,
    clientName: row.client?.full_name?.trim() || "Client",
    clientId: row.client_id,
    linkStatus: row.status,
    sharedAt: row.created_at,
    briefDocument,
    documents: docs.filter((d) => d.id !== briefDocument?.id),
    deadlines: deadlines ?? [],
    messages: messages ?? [],
  };
}

/** Consumer side: is this matter shared with a lawyer, and with whom? */
export async function getMatterShare(matterId: string): Promise<{
  lawyerName: string;
  status: string;
  messages: ClientMessage[];
} | null> {
  if (!isSupabaseConfigured) return null; // demo matters aren't shared
  const supabase = await createClient();
  const { data } = await supabase
    .from("lawyer_client_links")
    .select(
      "status, lawyer:profiles!lawyer_client_links_lawyer_id_fkey(full_name)",
    )
    .eq("matter_id", matterId)
    .in("status", ["invited", "active"])
    .maybeSingle();
  if (!data) return null;

  const { data: messages } = await supabase
    .from("client_messages")
    .select("*")
    .eq("matter_id", matterId)
    .order("created_at", { ascending: true })
    .limit(300);

  const lawyer = data.lawyer as unknown as { full_name: string | null } | null;
  return {
    lawyerName: lawyer?.full_name?.trim() || "Your lawyer",
    status: data.status,
    messages: messages ?? [],
  };
}

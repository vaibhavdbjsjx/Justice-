import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Deadline, Matter } from "@/lib/supabase/types";
import type { UiMessage } from "@/components/chat/chat-screen";
import { GENERAL_CATEGORY } from "./categories";

/**
 * Server-side reads for the matters UI. RLS scopes everything to the signed-in
 * user; demo mode serves fixtures from ./demo so the UI stays previewable
 * without Supabase (mutations are disabled there).
 */

export type MatterListItem = Matter & {
  messageCount: number;
  documentCount: number;
  /** Upcoming deadlines, soonest first (for the card's "next deadline"). */
  openDeadlines: Pick<Deadline, "id" | "title" | "due_date" | "status">[];
};

export type MatterDetail = {
  matter: Matter;
  deadlines: Deadline[];
  messages: UiMessage[];
};

export async function listMatters(userId: string): Promise<MatterListItem[]> {
  if (!isSupabaseConfigured) {
    const { demoMatterList } = await import("./demo");
    return demoMatterList();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matters")
    .select(
      "*, chat_messages(count), documents(count), deadlines(id,title,due_date,status)",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    // types.ts declares Relationships: [], so supabase-js can't infer the
    // embedded aggregates; PostgREST resolves them from the FKs at runtime.
    const { chat_messages, documents, deadlines, ...matter } =
      row as unknown as Matter & {
        chat_messages: { count: number }[];
        documents: { count: number }[];
        deadlines: Pick<Deadline, "id" | "title" | "due_date" | "status">[];
      };
    return {
      ...matter,
      messageCount: chat_messages?.[0]?.count ?? 0,
      documentCount: documents?.[0]?.count ?? 0,
      openDeadlines: (deadlines ?? [])
        .filter((d) => d.status === "upcoming")
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
    };
  });
}

export async function getMatterDetail(
  userId: string,
  matterId: string,
): Promise<MatterDetail | null> {
  if (!isSupabaseConfigured) {
    const { demoMatterDetail } = await import("./demo");
    return demoMatterDetail(matterId);
  }

  const supabase = await createClient();
  const { data: matter } = await supabase
    .from("matters")
    .select("*")
    .eq("id", matterId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!matter) return null;

  const [{ data: deadlines }, { data: rows }] = await Promise.all([
    supabase
      .from("deadlines")
      .select("*")
      .eq("matter_id", matterId)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("chat_messages")
      .select("id, role, content")
      .eq("matter_id", matterId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  return {
    matter,
    deadlines: deadlines ?? [],
    messages: (rows ?? []).map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
    })),
  };
}

/** True when this matter is the lazily created /chat home (Phase 3). */
export function isGeneralMatter(matter: Matter): boolean {
  return matter.category === GENERAL_CATEGORY;
}

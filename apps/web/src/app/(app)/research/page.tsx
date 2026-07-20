import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { getViewerTier } from "@/lib/billing/gate";
import { LockedPanel } from "@/components/billing/locked-panel";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { RESEARCH_CATEGORY } from "@/lib/matters/default-matter";
import { ChatScreen, type UiMessage } from "@/components/chat/chat-screen";

export const metadata: Metadata = { title: "Research" };

/**
 * Lawyer research accelerator (Phase 7, Part 4.3). Role-gated: legal
 * professionals only (demo mode previews it). History lives in the lawyer's
 * "Research workspace" matter, created lazily by /api/chat.
 */
export default async function ResearchPage() {
  const viewer = await getViewer();
  if (!viewer.user) return null; // (app) layout redirects
  if (viewer.profile?.role !== "lawyer" && !viewer.isDemo) {
    redirect("/dashboard");
  }
  if ((await getViewerTier(viewer)) !== "professional") {
    return (
      <LockedPanel
        title="Research accelerator"
        body="Jurisdiction-scoped research with citation discipline — settled law separated from open questions, every authority flagged for verification."
        tier="professional"
      />
    );
  }

  let initialMessages: UiMessage[] = [];
  if (isSupabaseConfigured && !viewer.isDemo) {
    const supabase = await createClient();
    const { data: matter } = await supabase
      .from("matters")
      .select("id")
      .eq("user_id", viewer.user.id)
      .eq("category", RESEARCH_CATEGORY)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (matter) {
      const { data: rows } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .eq("matter_id", matter.id)
        .order("created_at", { ascending: true })
        .limit(200);
      initialMessages = (rows ?? []).map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
      }));
    }
  }

  return (
    <ChatScreen
      initialMessages={initialMessages}
      jurisdiction={{
        country: viewer.profile?.country ?? null,
        state: viewer.profile?.state_province ?? null,
      }}
      firstName={null}
      audience="lawyer"
    />
  );
}

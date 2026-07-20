import type { Metadata } from "next";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ChatScreen, type UiMessage } from "@/components/chat/chat-screen";

export const metadata: Metadata = { title: "Assistant" };

/**
 * Consumer AI assistant (Phase 3). The (app) layout has already gated auth +
 * onboarding. History comes from the viewer's default "General consultation"
 * matter (created lazily by /api/chat); in demo mode the chat starts empty
 * and unpersisted.
 */
export default async function ChatPage() {
  const viewer = await getViewer();
  const p = viewer.profile;

  let initialMessages: UiMessage[] = [];
  if (isSupabaseConfigured && !viewer.isDemo && viewer.user) {
    const supabase = await createClient();
    const { data: matter } = await supabase
      .from("matters")
      .select("id")
      .eq("user_id", viewer.user.id)
      .eq("category", "general")
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

  const firstName = (p?.full_name ?? "").trim().split(" ")[0] || null;

  return (
    <ChatScreen
      initialMessages={initialMessages}
      jurisdiction={{
        country: p?.country ?? null,
        state: p?.state_province ?? null,
      }}
      firstName={firstName}
    />
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getTierFor } from "@/lib/billing/gate";
import { UPGRADE_PROFESSIONAL } from "@/lib/billing/tiers";

/**
 * Lawyer-side server actions (Phase 8). RLS carries the authorization:
 * intake_links policies restrict to the owning lawyer (with the lawyer-role
 * gate on insert), client_messages inserts require being a matter participant
 * writing as themselves.
 */

export type ActionResult = { error: string } | undefined;

const PREVIEW_ERROR: ActionResult = {
  error: "This is a local preview — connect Supabase to save changes.",
};
const SESSION_ERROR: ActionResult = {
  error: "Your session expired. Please sign in again.",
};
const SAVE_ERROR: ActionResult = {
  error: "That couldn't be saved. Please try again.",
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createIntakeLink(label: string): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;
  const trimmed = label.trim().slice(0, 80);

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  // Intake automation is a Professional feature (Phase 10).
  if ((await getTierFor(supabase, user.id)) !== "professional") {
    return { error: UPGRADE_PROFESSIONAL };
  }

  const { error } = await supabase.from("intake_links").insert({
    lawyer_id: user.id,
    label: trimmed || null,
  });
  if (error) return SAVE_ERROR;
  revalidatePath("/clients");
  return undefined;
}

export async function revokeIntakeLink(linkId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  const { error } = await supabase
    .from("intake_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId);
  if (error) return SAVE_ERROR;
  revalidatePath("/clients");
  return undefined;
}

/**
 * Consumer → lawyer request (Phase 9 linking). The client shares their OWN
 * matter (lcl_insert_by_client_owner — the Phase 1 consent path); status
 * starts 'invited' until the lawyer accepts. An optional intro lands as the
 * thread's first message.
 */
export async function requestLawyer(
  lawyerId: string,
  matterId: string,
  intro: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;
  if (lawyerId === user.id) {
    return { error: "You can't request yourself." };
  }

  const { error } = await supabase.from("lawyer_client_links").insert({
    lawyer_id: lawyerId,
    client_id: user.id,
    matter_id: matterId,
    status: "invited",
  });
  if (error) {
    // 23505 = primary-key conflict: this matter is already with this lawyer.
    if (error.code === "23505") {
      return { error: "You've already shared this matter with this lawyer." };
    }
    return SAVE_ERROR;
  }

  const trimmedIntro = intro.trim().slice(0, MAX_MESSAGE_CHARS);
  if (trimmedIntro) {
    // Best-effort — the link is what matters; a failed intro shouldn't undo it.
    await supabase.from("client_messages").insert({
      matter_id: matterId,
      sender_id: user.id,
      body: trimmedIntro,
    });
  }

  revalidatePath(`/matters/${matterId}`);
  revalidatePath("/clients");
  return undefined;
}

/** Lawyer responds to a pending request (lcl_update_participant). 'ended'
 * drops the lawyer's access entirely (is_matter_lawyer ignores it). */
export async function respondToClientRequest(
  matterId: string,
  clientId: string,
  response: "active" | "ended",
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  const { error } = await supabase
    .from("lawyer_client_links")
    .update({ status: response })
    .eq("lawyer_id", user.id)
    .eq("client_id", clientId)
    .eq("matter_id", matterId);
  if (error) return SAVE_ERROR;

  revalidatePath("/clients");
  revalidatePath(`/clients/${matterId}`);
  revalidatePath(`/matters/${matterId}`);
  return undefined;
}

const MAX_MESSAGE_CHARS = 8_000;

/** Post to the lawyer<->client thread (either side; RLS checks membership). */
export async function sendClientMessage(
  matterId: string,
  body: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;
  const trimmed = body.trim();
  if (!trimmed) return { error: "Write a message first." };
  if (trimmed.length > MAX_MESSAGE_CHARS) {
    return { error: "That message is a little long — please shorten it." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  const { error } = await supabase.from("client_messages").insert({
    matter_id: matterId,
    sender_id: user.id,
    body: trimmed,
  });
  if (error) return SAVE_ERROR;
  revalidatePath(`/clients/${matterId}`);
  revalidatePath(`/matters/${matterId}`);
  return undefined;
}

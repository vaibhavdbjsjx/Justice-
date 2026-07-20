"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DeadlineStatus, MatterStatus } from "@/lib/supabase/types";
import { getTierFor } from "@/lib/billing/gate";
import { countActiveSelfMatters } from "@/lib/billing/usage";
import { FREE_ACTIVE_MATTERS, UPGRADE_MATTER_LIMIT } from "@/lib/billing/tiers";
import { isKnownCategory } from "./categories";

/**
 * Mutations for matters + deadlines (Phase 4). All writes go through the
 * user-scoped client so RLS enforces ownership; errors surface as calm,
 * professional copy (Part 8). Demo mode (Supabase unconfigured) is read-only.
 */

const PREVIEW_ERROR = { error: "Changes aren't saved in this local preview." };
const SESSION_ERROR = { error: "Your session has expired. Please sign in again." };
const SAVE_ERROR = { error: "We couldn't save that just now. Please try again." };

const MAX_TITLE_CHARS = 200;
const MATTER_STATUSES: MatterStatus[] = ["active", "resolved", "archived"];
const DEADLINE_STATUSES: DeadlineStatus[] = ["upcoming", "completed", "missed"];

export type MatterInput = {
  title: string;
  category: string;
  jurisdictionCountry: string | null;
  jurisdictionState: string | null;
};

type ActionResult = { error?: string } | undefined;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function validateMatterInput(input: MatterInput): string | null {
  const title = input.title?.trim();
  if (!title) return "Give the matter a short title.";
  if (title.length > MAX_TITLE_CHARS) return "That title is a little long — please shorten it.";
  if (!isKnownCategory(input.category)) return "Choose a category for this matter.";
  return null;
}

export async function createMatter(input: MatterInput): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;
  const invalid = validateMatterInput(input);
  if (invalid) return { error: invalid };

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  // Free plan: one active self-created matter (Phase 10). Intake-created
  // matters don't route through here — the marketplace funnel stays open.
  if ((await getTierFor(supabase, user.id)) === "free") {
    const active = await countActiveSelfMatters(supabase, user.id);
    if (active >= FREE_ACTIVE_MATTERS) {
      return { error: UPGRADE_MATTER_LIMIT };
    }
  }

  const { data, error } = await supabase
    .from("matters")
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      category: input.category,
      jurisdiction_country: input.jurisdictionCountry?.trim() || null,
      jurisdiction_state: input.jurisdictionState?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return SAVE_ERROR;
  revalidatePath("/matters");
  redirect(`/matters/${data.id}`);
}

export async function updateMatter(
  matterId: string,
  input: MatterInput & { status: MatterStatus },
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;
  const invalid = validateMatterInput(input);
  if (invalid) return { error: invalid };
  if (!MATTER_STATUSES.includes(input.status)) return SAVE_ERROR;

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  const { error } = await supabase
    .from("matters")
    .update({
      title: input.title.trim(),
      category: input.category,
      status: input.status,
      jurisdiction_country: input.jurisdictionCountry?.trim() || null,
      jurisdiction_state: input.jurisdictionState?.trim() || null,
    })
    .eq("id", matterId)
    .eq("user_id", user.id);

  if (error) return SAVE_ERROR;
  revalidatePath("/matters");
  revalidatePath(`/matters/${matterId}`);
  revalidatePath(`/clients/${matterId}`);
  redirect(`/matters/${matterId}`);
}

export async function setMatterStatus(
  matterId: string,
  status: MatterStatus,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;
  if (!MATTER_STATUSES.includes(status)) return SAVE_ERROR;

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  const { error } = await supabase
    .from("matters")
    .update({ status })
    .eq("id", matterId)
    .eq("user_id", user.id);

  if (error) return SAVE_ERROR;
  revalidatePath("/matters");
  revalidatePath(`/matters/${matterId}`);
  revalidatePath(`/clients/${matterId}`);
  return undefined;
}

/** Permanently removes the matter and (by cascade) its chat, documents, and
 * deadlines. The UI confirms twice before calling this. */
export async function deleteMatter(matterId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  const { error } = await supabase
    .from("matters")
    .delete()
    .eq("id", matterId)
    .eq("user_id", user.id);

  if (error) return SAVE_ERROR;
  revalidatePath("/matters");
  redirect("/matters");
}

// ---- Deadlines --------------------------------------------------------------

export async function addDeadline(
  matterId: string,
  input: { title: string; dueDate: string | null },
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;
  const title = input.title?.trim();
  if (!title) return { error: "Give the deadline a short title." };
  if (title.length > MAX_TITLE_CHARS)
    return { error: "That title is a little long — please shorten it." };
  const dueDate = input.dueDate?.trim() || null;
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
    return { error: "That date doesn't look right. Please pick it again." };

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  // RLS (can_access_matter) enforces access; matter ownership is the check.
  const { error } = await supabase.from("deadlines").insert({
    matter_id: matterId,
    title,
    due_date: dueDate,
  });

  if (error) return SAVE_ERROR;
  revalidatePath(`/matters/${matterId}`);
  revalidatePath(`/clients/${matterId}`);
  revalidatePath("/matters");
  return undefined;
}

export async function setDeadlineStatus(
  deadlineId: string,
  matterId: string,
  status: DeadlineStatus,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;
  if (!DEADLINE_STATUSES.includes(status)) return SAVE_ERROR;

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  const { error } = await supabase
    .from("deadlines")
    .update({ status })
    .eq("id", deadlineId);

  if (error) return SAVE_ERROR;
  revalidatePath(`/matters/${matterId}`);
  revalidatePath(`/clients/${matterId}`);
  revalidatePath("/matters");
  return undefined;
}

export async function deleteDeadline(
  deadlineId: string,
  matterId: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return PREVIEW_ERROR;

  const { supabase, user } = await requireUser();
  if (!user) return SESSION_ERROR;

  const { error } = await supabase
    .from("deadlines")
    .delete()
    .eq("id", deadlineId);

  if (error) return SAVE_ERROR;
  revalidatePath(`/matters/${matterId}`);
  revalidatePath(`/clients/${matterId}`);
  revalidatePath("/matters");
  return undefined;
}

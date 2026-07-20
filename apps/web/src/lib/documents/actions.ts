"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Document mutations. Analysis/creation happens in /api/documents/analyze
 * (multipart); this holds the smaller lifecycle actions. RLS enforces access
 * (uploader or matter owner may delete).
 */

export async function deleteDocument(
  documentId: string,
  matterId: string,
): Promise<{ error?: string } | undefined> {
  if (!isSupabaseConfigured) {
    return { error: "Changes aren't saved in this local preview." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);
  if (error) return { error: "We couldn't delete that just now. Please try again." };

  revalidatePath("/documents");
  revalidatePath(`/matters/${matterId}`);
  redirect("/documents");
}

"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { requireSupabaseEnv } from "./env";

/** Browser-side Supabase client (uses the anon key; RLS enforces access). */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}

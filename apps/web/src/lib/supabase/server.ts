import { createServerClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import type { Database } from "./types";
import { requireSupabaseEnv } from "./env";

/**
 * Server-side Supabase client for Server Components, Route Handlers, and
 * Server Actions. Two auth transports, one call site (Phase 12):
 *
 *  - Web: the session lives in cookies (@supabase/ssr), refreshed by proxy.ts.
 *  - Mobile (Flutter): no cookies — requests carry `Authorization: Bearer
 *    <supabase access token>`. The client forwards that token to PostgREST,
 *    so RLS applies identically; token validation happens in getViewer().
 *
 * Always create a fresh client per request — never cache it.
 */

/** The raw bearer token on this request, when a mobile client sent one. */
export async function bearerToken(): Promise<string | null> {
  const headerStore = await headers();
  const match = headerStore.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function createClient(): Promise<SupabaseClient<Database>> {
  const { url, anonKey } = requireSupabaseEnv();

  const bearer = await bearerToken();
  if (bearer) {
    return createSupabaseClient<Database>(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const cookieStore = await cookies();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only — safe to
          // ignore; the middleware refreshes the session cookie instead.
        }
      },
    },
  });
}

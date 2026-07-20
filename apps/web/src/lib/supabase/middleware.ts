import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

/**
 * Refreshes the Supabase auth session on every request and forwards updated
 * cookies. Inert until Supabase env is configured, so the app still runs during
 * early phases without credentials.
 *
 * NOTE: do not run logic between creating the client and getUser() — that call
 * is what refreshes the token.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

import { createClient, SupabaseClient as SupabaseSDKClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseSDKClient | null = null;

/**
 * Returns a singleton Supabase client configured from environment variables.
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Returns null if env vars are not set (e.g. during static build).
 */
export function getSupabaseClient(): SupabaseSDKClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  supabaseInstance = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseInstance;
}

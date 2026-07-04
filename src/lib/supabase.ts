import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for the 1 & 9 Apparel PSEO frontend.
 *
 * Uses the public anon (publishable) key only — this client is safe to run on
 * the server and in the browser. The service role key must NEVER be referenced
 * here or anywhere in the frontend.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing environment variable NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local (see .env.example)."
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY. Add it to .env.local (see .env.example)."
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // No user sessions on these public landing pages — keep the client stateless.
    persistSession: false,
    autoRefreshToken: false,
  },
});

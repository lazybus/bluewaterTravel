import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv, getSupabaseSecretKey } from "@/lib/env";

export function createSupabaseAdminClient() {
  const { url } = getSupabaseBrowserEnv();
  const secretKey = getSupabaseSecretKey();

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
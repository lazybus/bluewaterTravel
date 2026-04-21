import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabaseBrowserEnv();

  return createBrowserClient(url, publishableKey);
}
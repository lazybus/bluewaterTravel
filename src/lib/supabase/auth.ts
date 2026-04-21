import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedActor = {
  userId: string;
  role: "user" | "curator" | "admin";
};

export async function getAuthenticatedActor(): Promise<AuthenticatedActor | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const adminClient = createSupabaseAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    role: (profile?.role ?? "user") as AuthenticatedActor["role"],
  };
}

export async function requireCuratorActor() {
  const actor = await getAuthenticatedActor();

  if (!actor) {
    return { actor: null, error: "Authentication required.", status: 401 as const };
  }

  if (actor.role !== "curator" && actor.role !== "admin") {
    return { actor: null, error: "Curator or admin access required.", status: 403 as const };
  }

  return { actor, error: null, status: 200 as const };
}
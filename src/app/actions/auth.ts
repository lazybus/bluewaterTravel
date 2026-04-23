"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
};

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function signIn(_state: AuthFormState | void, formData: FormData) {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const redirectTo = readString(formData, "redirectTo") || "/admin";

  if (!email || !password) {
    return { error: "Email and password are required." } satisfies AuthFormState;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message } satisfies AuthFormState;
  }

  redirect(redirectTo);
}

export async function signUp(_state: AuthFormState | void, formData: FormData) {
  const displayName = readString(formData, "displayName");
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const redirectTo = readString(formData, "redirectTo") || "/admin";

  if (!displayName || !email || !password) {
    return { error: "Display name, email, and password are required." } satisfies AuthFormState;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) {
    return { error: error.message } satisfies AuthFormState;
  }

  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
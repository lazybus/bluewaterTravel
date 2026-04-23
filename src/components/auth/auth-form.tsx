"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/app/actions/auth";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
  action: (
    state: AuthFormState | void,
    formData: FormData,
  ) => Promise<AuthFormState | void>;
  redirectTo?: string;
};

const initialState: AuthFormState = {};

export function AuthForm({ mode, action, redirectTo = "/admin" }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {mode === "sign-up" && (
        <label className="grid gap-2 text-sm text-ink-soft">
          Display name
          <input
            name="displayName"
            className="rounded-2xl border border-line bg-white px-3 py-3 text-sm text-ink outline-none"
            placeholder="Bruce trip curator"
          />
        </label>
      )}

      <label className="grid gap-2 text-sm text-ink-soft">
        Email
        <input
          name="email"
          type="email"
          className="rounded-2xl border border-line bg-white px-3 py-3 text-sm text-ink outline-none"
          placeholder="you@example.com"
        />
      </label>

      <label className="grid gap-2 text-sm text-ink-soft">
        Password
        <input
          name="password"
          type="password"
          className="rounded-2xl border border-line bg-white px-3 py-3 text-sm text-ink outline-none"
          placeholder="Minimum 8 characters"
        />
      </label>

      {state?.error && (
        <p className="rounded-2xl border border-[#b95c5c] bg-[#fff4f4] px-4 py-3 text-sm text-[#8f2323]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-lagoon px-5 py-3 text-sm font-semibold text-foam transition hover:bg-lagoon-strong disabled:opacity-60"
      >
        {pending ? "Submitting..." : mode === "sign-in" ? "Sign in" : "Create account"}
      </button>

      <p className="text-sm text-ink-soft">
        {mode === "sign-in" ? "Need an account? " : "Already have an account? "}
        <Link
          href={mode === "sign-in" ? `/auth/sign-up?redirectTo=${encodeURIComponent(redirectTo)}` : `/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-lagoon-strong"
        >
          {mode === "sign-in" ? "Create one" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
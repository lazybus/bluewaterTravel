import { signOut } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-full border border-line bg-white/70 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
      >
        Sign out
      </button>
    </form>
  );
}
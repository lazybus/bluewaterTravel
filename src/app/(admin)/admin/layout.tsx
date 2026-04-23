import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireCuratorActor } from "@/lib/supabase/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await requireCuratorActor();

  if (!access.actor) {
    if (access.status === 401) {
      redirect("/auth/sign-in?redirectTo=/admin");
    }

    redirect("/dashboard");
  }

  return (
    <div className="page-frame flex min-h-screen flex-col py-4 md:py-6">
      <header className="card-surface sticky top-4 z-10 flex items-center justify-between gap-4 rounded-full px-5 py-3">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-lagoon-strong uppercase">
            Bluewater Travels Admin
          </p>
          <p className="text-xs text-ink-soft">Role: {access.actor.role}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-full px-4 py-2 text-sm text-ink-soft transition hover:bg-white/70 hover:text-ink">
            Dashboard
          </Link>
          <Link href="/admin/pois" className="rounded-full px-4 py-2 text-sm text-ink-soft transition hover:bg-white/70 hover:text-ink">
            Map Points
          </Link>
          <SignOutButton />
        </div>
      </header>
      <div className="flex flex-1 flex-col py-6">{children}</div>
    </div>
  );
}
import type { ReactNode } from "react";
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trips", label: "Trips" },
  { href: "/admin", label: "Admin" },
];

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page-frame flex min-h-screen flex-col py-4 md:py-6">
      <header className="card-surface sticky top-4 z-10 flex items-center justify-between rounded-full px-5 py-3">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-lagoon-strong uppercase">
            Bluewater Travels
          </p>
        </div>
        <nav className="flex items-center gap-3 text-sm text-ink-soft">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 hover:bg-white/70 hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="flex flex-1 flex-col py-6">{children}</div>
    </div>
  );
}
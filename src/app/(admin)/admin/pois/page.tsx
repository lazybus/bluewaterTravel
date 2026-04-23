import { PoiWorkspaceClient } from "@/features/admin/poi-workspace-client";

export default function AdminPoisPage() {
  return (
    <main className="page-frame flex min-h-screen flex-col gap-6 py-6 md:py-10">
      <section className="card-surface rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Map Point Workspace</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
          Curate map points and planning metadata
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft md:text-base">
          This central admin form now handles attractions, restaurants, accommodations,
          logistics points, viewpoints, and their optional image associations.
        </p>
      </section>

      <PoiWorkspaceClient />
    </main>
  );
}
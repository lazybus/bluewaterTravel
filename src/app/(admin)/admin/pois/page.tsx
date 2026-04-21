import { PoiWorkspaceClient } from "@/features/admin/poi-workspace-client";

export default function AdminPoisPage() {
  return (
    <main className="page-frame flex min-h-screen flex-col gap-6 py-6 md:py-10">
      <section className="card-surface rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">POI Workspace</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
          Curate POIs and planning metadata
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft md:text-base">
          This is the first end-to-end admin surface for the curated data model.
          It covers core POI records plus the scheduling fields that feed itinerary
          validation.
        </p>
      </section>

      <PoiWorkspaceClient />
    </main>
  );
}
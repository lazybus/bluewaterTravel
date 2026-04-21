import Link from "next/link";

const adminAreas = [
  "POI curation",
  "Seasonality and hours",
  "Warnings and restrictions",
  "External source monitoring",
];

export default function AdminHomePage() {
  return (
    <main className="page-frame flex min-h-screen flex-col gap-6 py-6 md:py-10">
      <section className="card-surface rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Admin Workspace</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
          Content operations and data control
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft md:text-base">
          This route group will become the secure curation surface for POIs,
          seasonal hours, itinerary warnings, and external feed review.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminAreas.map((area) => (
          <article key={area} className="card-surface rounded-[1.5rem] p-5">
            <p className="eyebrow">Module</p>
            <p className="mt-3 text-lg font-semibold text-ink">{area}</p>
          </article>
        ))}
      </section>

      <section className="card-surface rounded-[1.5rem] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Working CRUD surface</p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-soft">
              The first POI editor now covers core POI fields plus hours, warnings,
              and activity metadata through authenticated admin routes.
            </p>
          </div>
          <Link
            href="/admin/pois"
            className="rounded-full bg-lagoon px-5 py-3 text-sm font-semibold text-foam transition hover:bg-lagoon-strong"
          >
            Open POI workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
import Link from "next/link";

const tripMilestones = [
  "Active trip snapshot stored locally",
  "Offline itinerary edits queued for sync",
  "Restricted-stop warnings shown during planning",
];

export default function TripsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="card-surface rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Trips</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
          Itinerary builder foundation
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft md:text-base">
          The next implementation pass will wire this route to the local trip
          store and then to Supabase-backed synchronization. For now, the page
          marks the contract for the builder surface.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {tripMilestones.map((item) => (
          <article key={item} className="card-surface rounded-[1.5rem] p-5">
            <p className="eyebrow">Planned capability</p>
            <p className="mt-3 text-lg font-semibold text-ink">{item}</p>
          </article>
        ))}
      </section>

      <section className="card-surface rounded-[1.5rem] p-5">
        <p className="eyebrow">Working route</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-sm leading-7 text-ink-soft">
            A first itinerary editing route is live with typed scheduling logic and
            sample validation output.
          </p>
          <Link
            href="/trips/sample-trip/edit"
            className="rounded-full bg-lagoon px-5 py-3 text-sm font-semibold text-foam transition hover:bg-lagoon-strong"
          >
            Open sample editor
          </Link>
        </div>
      </section>
    </main>
  );
}
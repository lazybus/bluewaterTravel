import Link from "next/link";

const launchTracks = [
  {
    title: "Daily conditions",
    description:
      "Weather, wind, marine operability, and dark-sky signals tuned for Bruce Peninsula decision-making.",
  },
  {
    title: "Itinerary builder",
    description:
      "Timeline planning with travel buffers, opening-hours validation, and red-tape alerts for restricted stops.",
  },
  {
    title: "Offline field mode",
    description:
      "Active trip, essential POIs, and map regions stay available through dead zones around Cyprus Lake and beyond.",
  },
];

export default function MarketingHome() {
  return (
    <main className="page-frame flex min-h-screen flex-col gap-10 py-6 md:py-10">
      <section className="hero-grid items-stretch">
        <div className="card-surface rounded-[2rem] p-6 md:p-10">
          <p className="eyebrow">Bruce Peninsula Trip Planning</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-ink md:text-6xl">
            Build a trip that survives ferry schedules, full parking lots, and dead zones.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink-soft md:text-lg">
            Bluewater Travels is an offline-first planning platform for visitors to
            the Bruce Peninsula. It combines curated local logistics, trail and
            dining intelligence, and weather-aware itinerary building in a single
            mobile-first PWA.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="rounded-full bg-lagoon px-6 py-3 text-sm font-semibold text-foam transition hover:bg-lagoon-strong"
            >
              Open Dashboard
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-line bg-white/60 px-6 py-3 text-sm font-semibold text-ink transition hover:bg-white"
            >
              Admin Workspace
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          {launchTracks.map((track) => (
            <article key={track.title} className="card-surface rounded-[1.75rem] p-5">
              <p className="eyebrow">Planned Surface</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">{track.title}</h2>
              <p className="mt-3 text-sm leading-7 text-ink-soft">
                {track.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="card-surface rounded-[2rem] p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Implementation Start</p>
            <h2 className="mt-3 text-3xl font-semibold text-ink">
              First slices now in progress
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-ink-soft">
            The current implementation establishes the route groups, PWA manifest,
            service worker registration, and local-first data scaffolding before
            deeper itinerary logic and Supabase synchronization are added.
          </p>
        </div>
      </section>
    </main>
  );
}
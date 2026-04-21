const conditionCards = [
  { label: "Weather", value: "Provider pending", note: "Open-Meteo integration" },
  { label: "Marine", value: "Provider pending", note: "Wind and wave operability" },
  { label: "Astronomy", value: "Provider pending", note: "Moon phase and cloud cover" },
];

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="card-surface rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Traveler Dashboard</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
          Daily conditions and trip status
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft md:text-base">
          This surface will aggregate live conditions, sync state, and the active
          trip snapshot. The implementation priority is to keep this page useful
          even when network quality drops.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {conditionCards.map((card) => (
          <article key={card.label} className="card-surface rounded-[1.5rem] p-5">
            <p className="eyebrow">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-ink">{card.value}</p>
            <p className="mt-3 text-sm leading-7 text-ink-soft">{card.note}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
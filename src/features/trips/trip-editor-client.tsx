"use client";

import { useEffect, useState, useTransition } from "react";
import { validateTripDay } from "@/lib/domain/scheduling";
import {
  getOrCreateOfflineTripDraft,
  queueTripDraftMutation,
  saveOfflineTripDraft,
} from "@/lib/offline/trips";
import type { OfflineTripDraft, OfflineTripItem } from "@/lib/offline/db";

const travelDurations = {
  "Breakfast in Tobermory->The Grotto hike": 35,
  "The Grotto hike->Early fish fry": 20,
};

const operatingWindows = {
  "poi-breakfast": { opensAtMinutes: 8 * 60, closesAtMinutes: 14 * 60 },
  "poi-grotto": { opensAtMinutes: 7 * 60, closesAtMinutes: 20 * 60 },
  "poi-fish-fry": { opensAtMinutes: 11 * 60, closesAtMinutes: 21 * 60 },
};

function buildTravelLookup(items: OfflineTripItem[]) {
  return items.reduce<Record<string, number>>((lookup, item, index) => {
    const nextItem = items[index + 1];

    if (!nextItem) {
      return lookup;
    }

    const labelKey = `${item.title}->${nextItem.title}` as keyof typeof travelDurations;
    const duration = travelDurations[labelKey] ?? 0;

    lookup[`${item.id}->${nextItem.id}`] = duration;
    return lookup;
  }, {});
}

function toInputValue(timestamp: string) {
  return timestamp.slice(0, 16);
}

function toIsoValue(timestamp: string) {
  return new Date(timestamp).toISOString();
}

export function TripEditorClient({ tripId }: { tripId: string }) {
  const [tripDraft, setTripDraft] = useState<OfflineTripDraft | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    void getOrCreateOfflineTripDraft(tripId).then((draft) => {
      if (isMounted) {
        setTripDraft(draft);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [tripId]);

  if (!tripDraft) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="card-surface rounded-[1.5rem] px-6 py-5 text-sm text-ink-soft">
          Loading the local trip draft...
        </div>
      </main>
    );
  }

  const tripDay = tripDraft.days[0];
  const validation = validateTripDay(
    tripDay.items.map((item) => ({
      id: item.id,
      title: item.title,
      poiId: item.poiId,
      startAt: item.startAt,
      endAt: item.endAt,
    })),
    buildTravelLookup(tripDay.items),
    operatingWindows,
  );

  function updateItem(itemId: string, changes: Partial<OfflineTripItem>) {
    setTripDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        days: currentDraft.days.map((day) => {
          if (day.id !== tripDay.id) {
            return day;
          }

          return {
            ...day,
            items: day.items.map((item) => {
              if (item.id !== itemId) {
                return item;
              }

              return {
                ...item,
                ...changes,
              };
            }),
          };
        }),
      };
    });
  }

  function addStop() {
    setTripDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextItem: OfflineTripItem = {
        id: crypto.randomUUID(),
        title: "New stop",
        startAt: "2026-06-20T15:00:00-04:00",
        endAt: "2026-06-20T16:00:00-04:00",
      };

      return {
        ...currentDraft,
        days: currentDraft.days.map((day) => {
          if (day.id !== tripDay.id) {
            return day;
          }

          return {
            ...day,
            items: [...day.items, nextItem],
          };
        }),
      };
    });
  }

  function saveDraft() {
    startTransition(() => {
      void (async () => {
        if (!tripDraft) {
          return;
        }

        const nextDraft = await saveOfflineTripDraft({
          ...tripDraft,
          version: tripDraft.version + 1,
        });

        await queueTripDraftMutation(nextDraft, "update");
        setTripDraft(nextDraft);
        setSaveMessage(`Saved locally at ${new Date(nextDraft.updatedAt).toLocaleTimeString()}.`);
      })();
    });
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="card-surface rounded-[2rem] p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Itinerary Builder</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
              {tripDraft.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft md:text-base">
              This editor now reads from and writes to Dexie. Saving queues an
              offline mutation for later sync instead of relying on hardcoded page data.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm text-ink-soft md:items-end">
            <span>Trip version {tripDraft.version}</span>
            <span>{saveMessage ?? "No unsynced save yet."}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <article className="card-surface rounded-[1.5rem] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Local trip day</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">{tripDay.title}</h2>
            </div>
            <button
              type="button"
              onClick={addStop}
              className="rounded-full border border-line bg-white/70 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
            >
              Add stop
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            {tripDay.items.map((item) => (
              <article key={item.id} className="rounded-[1.5rem] border border-line bg-white/70 p-4">
                <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_1fr]">
                  <label className="grid gap-2 text-sm text-ink-soft">
                    Stop title
                    <input
                      value={item.title}
                      onChange={(event) => updateItem(item.id, { title: event.target.value })}
                      className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-ink-soft">
                    Start
                    <input
                      type="datetime-local"
                      value={toInputValue(item.startAt)}
                      onChange={(event) => updateItem(item.id, { startAt: toIsoValue(event.target.value) })}
                      className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-ink-soft">
                    End
                    <input
                      type="datetime-local"
                      value={toInputValue(item.endAt)}
                      onChange={(event) => updateItem(item.id, { endAt: toIsoValue(event.target.value) })}
                      className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none"
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm leading-7 text-ink-soft">
              Local changes are durable immediately in browser storage once saved, then
              queued for `/api/sync/trips`.
            </p>
            <button
              type="button"
              onClick={saveDraft}
              disabled={isPending}
              className="rounded-full bg-lagoon px-5 py-3 text-sm font-semibold text-foam transition hover:bg-lagoon-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save locally"}
            </button>
          </div>
        </article>

        <article className="card-surface rounded-[1.5rem] p-5">
          <p className="eyebrow">Validation summary</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <p className="text-sm text-ink-soft">Scheduled minutes</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{validation.totalScheduledMinutes}</p>
            </div>
            <div>
              <p className="text-sm text-ink-soft">Travel minutes</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{validation.totalTravelMinutes}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {validation.issues.length === 0 ? (
              <div className="rounded-3xl border border-line bg-white/70 px-4 py-3 text-sm text-ink-soft">
                No local validation issues yet.
              </div>
            ) : (
              validation.issues.map((issue) => (
                <div key={`${issue.itemId}-${issue.code}`} className="rounded-3xl border border-line bg-white/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-strong">
                    {issue.severity}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-ink">{issue.message}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
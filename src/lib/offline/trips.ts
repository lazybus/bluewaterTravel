import {
  offlineDb,
  type OfflineTripDraft,
  type OfflineTripItem,
  type PendingMutation,
} from "@/lib/offline/db";

function buildDefaultTripItems(): OfflineTripItem[] {
  return [
    {
      id: crypto.randomUUID(),
      title: "Breakfast in Tobermory",
      poiId: "poi-breakfast",
      startAt: "2026-06-20T08:30:00-04:00",
      endAt: "2026-06-20T09:30:00-04:00",
    },
    {
      id: crypto.randomUUID(),
      title: "The Grotto hike",
      poiId: "poi-grotto",
      startAt: "2026-06-20T10:00:00-04:00",
      endAt: "2026-06-20T13:00:00-04:00",
    },
    {
      id: crypto.randomUUID(),
      title: "Early fish fry",
      poiId: "poi-fish-fry",
      startAt: "2026-06-20T13:20:00-04:00",
      endAt: "2026-06-20T14:10:00-04:00",
    },
  ];
}

export function buildDefaultTripDraft(tripId: string): OfflineTripDraft {
  return {
    tripId,
    title: tripId === "sample-trip" ? "Bruce Peninsula sample day" : `Trip ${tripId}`,
    startDate: "2026-06-20",
    endDate: "2026-06-20",
    version: 1,
    updatedAt: new Date().toISOString(),
    days: [
      {
        id: crypto.randomUUID(),
        tripDate: "2026-06-20",
        title: "Arrival and shoreline day",
        items: buildDefaultTripItems(),
      },
    ],
  };
}

export async function getOrCreateOfflineTripDraft(tripId: string) {
  const existingDraft = await offlineDb.tripDrafts.get(tripId);

  if (existingDraft) {
    return existingDraft;
  }

  const newDraft = buildDefaultTripDraft(tripId);

  await offlineDb.transaction(
    "rw",
    offlineDb.tripDrafts,
    offlineDb.activeTripSnapshots,
    async () => {
      await offlineDb.tripDrafts.put(newDraft);
      await offlineDb.activeTripSnapshots.put({
        tripId: newDraft.tripId,
        title: newDraft.title,
        startDate: newDraft.startDate,
        endDate: newDraft.endDate,
        version: newDraft.version,
        updatedAt: newDraft.updatedAt,
      });
    },
  );

  return newDraft;
}

export async function saveOfflineTripDraft(tripDraft: OfflineTripDraft) {
  const nextDraft = {
    ...tripDraft,
    updatedAt: new Date().toISOString(),
  };

  await offlineDb.transaction(
    "rw",
    offlineDb.tripDrafts,
    offlineDb.activeTripSnapshots,
    async () => {
      await offlineDb.tripDrafts.put(nextDraft);
      await offlineDb.activeTripSnapshots.put({
        tripId: nextDraft.tripId,
        title: nextDraft.title,
        startDate: nextDraft.startDate,
        endDate: nextDraft.endDate,
        version: nextDraft.version,
        updatedAt: nextDraft.updatedAt,
      });
    },
  );

  return nextDraft;
}

export async function queueTripDraftMutation(
  tripDraft: OfflineTripDraft,
  operation: PendingMutation["operation"],
  baseTripVersion: number,
) {
  await offlineDb.pendingMutations.add({
    tripId: tripDraft.tripId,
    entityType: "trip",
    entityId: tripDraft.tripId,
    operation,
    baseTripVersion,
    payload: tripDraft,
    clientMutationId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function getTripPendingMutations(tripId: string) {
  return offlineDb.pendingMutations.where("tripId").equals(tripId).sortBy("createdAt");
}

export async function clearPendingMutations(ids: number[]) {
  if (ids.length === 0) {
    return;
  }

  await offlineDb.pendingMutations.bulkDelete(ids);
}

export async function bumpPendingMutationRetryCount(ids: number[]) {
  await Promise.all(
    ids.map(async (id) => {
      const mutation = await offlineDb.pendingMutations.get(id);

      if (!mutation) {
        return;
      }

      await offlineDb.pendingMutations.update(id, {
        retryCount: (mutation.retryCount ?? 0) + 1,
      });
    }),
  );
}
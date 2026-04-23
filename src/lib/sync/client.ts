import {
  bumpPendingMutationRetryCount,
  clearPendingMutations,
  getTripPendingMutations,
  saveOfflineTripDraft,
} from "@/lib/offline/trips";
import { offlineDb, type OfflineTripDraft } from "@/lib/offline/db";
import type { TripSyncRequest, TripSyncResponse } from "@/lib/sync/contracts";

const DEVICE_STORAGE_KEY = "bluewater-device-id";

export type TripSyncAttemptResult =
  | { status: "synced"; nextTripVersion: number }
  | { status: "queued"; message: string }
  | { status: "conflict"; message: string; serverVersion: number }
  | { status: "error"; message: string };

function getOrCreateDeviceId() {
  const existingValue = window.localStorage.getItem(DEVICE_STORAGE_KEY);

  if (existingValue) {
    return existingValue;
  }

  const nextValue = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_STORAGE_KEY, nextValue);
  return nextValue;
}

async function loadDraft(tripId: string) {
  return offlineDb.tripDrafts.get(tripId);
}

export async function syncTripMutations(tripId: string): Promise<TripSyncAttemptResult> {
  const pendingMutations = await getTripPendingMutations(tripId);

  if (pendingMutations.length === 0) {
    return {
      status: "queued",
      message: "No local changes are waiting to sync.",
    };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      status: "queued",
      message: "Offline. Changes are still queued locally.",
    };
  }

  const draft = await loadDraft(tripId);

  if (!draft) {
    return {
      status: "error",
      message: "Local draft not found for sync.",
    };
  }

  const requestBody: TripSyncRequest = {
    tripId,
    deviceId: getOrCreateDeviceId(),
    baseTripVersion: pendingMutations[0].baseTripVersion,
    mutations: pendingMutations.map((mutation) => ({
      clientMutationId: mutation.clientMutationId,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      operation: mutation.operation,
      payload: mutation.payload,
    })),
  };

  const response = await fetch("/api/sync/trips", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-version": "0.1.0",
    },
    body: JSON.stringify(requestBody),
  });

  const body = (await response.json()) as TripSyncResponse | { error?: string };

  if (response.status === 409 && "nextTripVersion" in body) {
    await bumpPendingMutationRetryCount(
      pendingMutations.flatMap((mutation) =>
        mutation.id === undefined ? [] : [mutation.id],
      ),
    );

    return {
      status: "conflict",
      message: body.conflicts[0]?.reason ?? "Server conflict detected.",
      serverVersion: body.nextTripVersion,
    };
  }

  if (!response.ok || !("nextTripVersion" in body)) {
    await bumpPendingMutationRetryCount(
      pendingMutations.flatMap((mutation) =>
        mutation.id === undefined ? [] : [mutation.id],
      ),
    );

    return {
      status: "error",
      message: ("error" in body && body.error) || "Sync request failed.",
    };
  }

  await clearPendingMutations(
    pendingMutations.flatMap((mutation) =>
      mutation.id === undefined ? [] : [mutation.id],
    ),
  );

  const nextDraft: OfflineTripDraft = {
    ...draft,
    version: body.nextTripVersion,
    updatedAt: body.appliedAt,
  };

  await saveOfflineTripDraft(nextDraft);

  return {
    status: "synced",
    nextTripVersion: body.nextTripVersion,
  };
}
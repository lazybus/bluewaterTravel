import Dexie, { type Table } from "dexie";

export type PendingMutation = {
  id?: number;
  tripId: string;
  entityType: "trip" | "tripDay" | "tripItem";
  entityId: string;
  operation: "insert" | "update" | "delete" | "reorder";
  baseTripVersion: number;
  payload: Record<string, unknown>;
  clientMutationId: string;
  createdAt: string;
  retryCount?: number;
};

export type ActiveTripSnapshot = {
  tripId: string;
  title: string;
  startDate: string;
  endDate: string;
  version: number;
  updatedAt: string;
};

export type OfflineTripItem = {
  id: string;
  title: string;
  poiId?: string;
  startAt: string;
  endAt: string;
};

export type OfflineTripDay = {
  id: string;
  tripDate: string;
  title: string;
  items: OfflineTripItem[];
};

export type OfflineTripDraft = {
  tripId: string;
  title: string;
  startDate: string;
  endDate: string;
  version: number;
  updatedAt: string;
  days: OfflineTripDay[];
};

export type CachedPoi = {
  id: string;
  name: string;
  poiKind: string;
  latitude: number;
  longitude: number;
  cachedAt: string;
};

export type DownloadedRegion = {
  id: string;
  name: string;
  bounds: [number, number, number, number];
  pmtilesUrl: string;
  downloadedAt: string;
};

class BluewaterOfflineDatabase extends Dexie {
  activeTripSnapshots!: Table<ActiveTripSnapshot, string>;
  tripDrafts!: Table<OfflineTripDraft, string>;
  pendingMutations!: Table<PendingMutation, number>;
  poiCache!: Table<CachedPoi, string>;
  downloadedRegions!: Table<DownloadedRegion, string>;

  constructor() {
    super("bluewater-travels");

    this.version(1).stores({
      activeTripSnapshots: "tripId, updatedAt",
      tripDrafts: "tripId, updatedAt",
      pendingMutations: "++id, tripId, entityType, entityId, createdAt",
      poiCache: "id, poiKind, cachedAt",
      downloadedRegions: "id, downloadedAt",
    });
  }
}

export const offlineDb = new BluewaterOfflineDatabase();
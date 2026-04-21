export type SyncMutationOperation = "insert" | "update" | "delete" | "reorder";

export type TripSyncMutation = {
  clientMutationId: string;
  entityType: "trip" | "tripDay" | "tripItem";
  entityId: string;
  operation: SyncMutationOperation;
  payload: Record<string, unknown>;
};

export type TripSyncRequest = {
  tripId: string;
  deviceId: string;
  baseTripVersion: number;
  mutations: TripSyncMutation[];
};

export type TripSyncConflict = {
  entityId: string;
  fields: string[];
  reason: string;
};

export type TripSyncResponse = {
  tripId: string;
  nextTripVersion: number;
  acceptedMutationIds: string[];
  conflicts: TripSyncConflict[];
  appliedAt: string;
};
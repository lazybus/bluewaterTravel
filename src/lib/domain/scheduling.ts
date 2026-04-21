export type PlannerTripItem = {
  id: string;
  title: string;
  poiId?: string;
  startAt: string;
  endAt: string;
};

export type OperatingWindow = {
  opensAtMinutes: number;
  closesAtMinutes: number;
};

export type TravelDurationLookup = Record<string, number>;

export type TripValidationIssue = {
  itemId: string;
  severity: "warning" | "critical";
  code: "invalid-duration" | "travel-overlap" | "outside-hours";
  message: string;
};

export type TripValidationResult = {
  issues: TripValidationIssue[];
  totalScheduledMinutes: number;
  totalTravelMinutes: number;
};

function getMinuteOfDay(timestamp: string) {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
}

function getDurationInMinutes(startAt: string, endAt: string) {
  return Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
}

function buildTravelKey(currentItemId: string, nextItemId: string) {
  return `${currentItemId}->${nextItemId}`;
}

export function validateTripDay(
  items: PlannerTripItem[],
  travelDurations: TravelDurationLookup,
  operatingWindows: Record<string, OperatingWindow> = {},
): TripValidationResult {
  const sortedItems = [...items].sort((left, right) => {
    return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
  });

  const issues: TripValidationIssue[] = [];
  let totalScheduledMinutes = 0;
  let totalTravelMinutes = 0;

  sortedItems.forEach((item, index) => {
    const duration = getDurationInMinutes(item.startAt, item.endAt);
    totalScheduledMinutes += Math.max(duration, 0);

    if (duration <= 0) {
      issues.push({
        itemId: item.id,
        severity: "critical",
        code: "invalid-duration",
        message: `${item.title} must end after it starts.`,
      });
    }

    if (item.poiId && operatingWindows[item.poiId]) {
      const window = operatingWindows[item.poiId];
      const startMinutes = getMinuteOfDay(item.startAt);
      const endMinutes = getMinuteOfDay(item.endAt);

      if (
        startMinutes < window.opensAtMinutes ||
        endMinutes > window.closesAtMinutes
      ) {
        issues.push({
          itemId: item.id,
          severity: "warning",
          code: "outside-hours",
          message: `${item.title} falls outside the curated operating window.`,
        });
      }
    }

    const nextItem = sortedItems[index + 1];

    if (!nextItem) {
      return;
    }

    const travelMinutes =
      travelDurations[buildTravelKey(item.id, nextItem.id)] ?? 0;

    totalTravelMinutes += travelMinutes;

    const currentEnd = new Date(item.endAt).getTime();
    const nextStart = new Date(nextItem.startAt).getTime();

    if (currentEnd + travelMinutes * 60000 > nextStart) {
      issues.push({
        itemId: nextItem.id,
        severity: "critical",
        code: "travel-overlap",
        message: `${nextItem.title} starts before travel time from ${item.title} is accounted for.`,
      });
    }
  });

  return {
    issues,
    totalScheduledMinutes,
    totalTravelMinutes,
  };
}
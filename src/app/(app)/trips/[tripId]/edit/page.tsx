import { TripEditorClient } from "@/features/trips/trip-editor-client";

type EditTripPageProps = {
  params: Promise<{
    tripId: string;
  }>;
};

export default async function EditTripPage({ params }: EditTripPageProps) {
  const { tripId } = await params;

  return <TripEditorClient tripId={tripId} />;
}
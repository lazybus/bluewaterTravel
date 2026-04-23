import type { PoiImageRecord } from "@/lib/admin/poi-records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const POI_MEDIA_BUCKET = "poi-media";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type PoiMediaRow = {
  id: string;
  image_url: string;
  alt_text: string | null;
  caption: string | null;
  is_thumbnail: boolean;
  sort_order: number;
  storage_path: string | null;
};

export type PoiMediaSyncImage = {
  id: string;
  altText: string;
  caption: string;
};

export function mapPoiMediaRecord(row: PoiMediaRow): PoiImageRecord {
  return {
    id: row.id,
    url: row.image_url,
    altText: row.alt_text ?? "",
    caption: row.caption ?? "",
    storagePath: row.storage_path ?? undefined,
  };
}

export function buildPoiMediaStoragePath(poiId: string, fileName: string) {
  const sanitizedFileName = sanitizeFileName(fileName);
  return `${poiId}/${crypto.randomUUID()}-${sanitizedFileName}`;
}

export async function fetchPoiMediaRows(adminClient: AdminClient, poiId: string) {
  return adminClient
    .from("poi_media")
    .select("id, image_url, alt_text, caption, is_thumbnail, sort_order, storage_path")
    .eq("poi_id", poiId)
    .order("sort_order", { ascending: true });
}

export async function syncPoiMediaRows(
  adminClient: AdminClient,
  poiId: string,
  images: PoiMediaSyncImage[],
) {
  const { error: resetError } = await adminClient
    .from("poi_media")
    .update({ is_thumbnail: false })
    .eq("poi_id", poiId);

  if (resetError) {
    return { data: null, error: resetError };
  }

  const updates = await Promise.all(
    images.map((image, index) =>
      adminClient
        .from("poi_media")
        .update({
          alt_text: image.altText || null,
          caption: image.caption || null,
          is_thumbnail: index === 0,
          sort_order: index,
        })
        .eq("poi_id", poiId)
        .eq("id", image.id),
    ),
  );

  const updateError = updates.find((result) => result.error)?.error ?? null;

  if (updateError) {
    return { data: null, error: updateError };
  }

  return fetchPoiMediaRows(adminClient, poiId);
}

export async function normalizePoiMediaRows(adminClient: AdminClient, poiId: string) {
  const { data, error } = await fetchPoiMediaRows(adminClient, poiId);

  if (error) {
    return { data: null, error };
  }

  if (!data || data.length === 0) {
    return { data: [], error: null };
  }

  return syncPoiMediaRows(
    adminClient,
    poiId,
    data.map((image) => ({
      id: image.id,
      altText: image.alt_text ?? "",
      caption: image.caption ?? "",
    })),
  );
}

function sanitizeFileName(fileName: string) {
  const trimmedFileName = fileName.trim();

  if (!trimmedFileName) {
    return "image";
  }

  const cleaned = trimmedFileName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "image";
}
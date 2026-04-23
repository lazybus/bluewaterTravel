import { NextResponse } from "next/server";
import {
  buildPoiMediaStoragePath,
  fetchPoiMediaRows,
  mapPoiMediaRecord,
  POI_MEDIA_BUCKET,
  syncPoiMediaRows,
  type PoiMediaSyncImage,
} from "@/lib/admin/poi-media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCuratorActor } from "@/lib/supabase/auth";

type PoiMediaSyncRequest = {
  images: PoiMediaSyncImage[];
};

function isPoiMediaSyncRequest(value: unknown): value is PoiMediaSyncRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PoiMediaSyncRequest>;

  return Array.isArray(candidate.images) && candidate.images.every(isPoiMediaSyncImage);
}

function isPoiMediaSyncImage(value: unknown): value is PoiMediaSyncImage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PoiMediaSyncImage>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.altText === "string" &&
    typeof candidate.caption === "string"
  );
}

export async function POST(request: Request, ctx: RouteContext<"/api/admin/pois/[poiId]/media">) {
  const access = await requireCuratorActor();

  if (!access.actor) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { poiId } = await ctx.params;
  const adminClient = createSupabaseAdminClient();

  const { data: poi, error: poiError } = await adminClient
    .from("pois")
    .select("id")
    .eq("id", poiId)
    .maybeSingle();

  if (poiError) {
    return NextResponse.json({ error: poiError.message }, { status: 500 });
  }

  if (!poi) {
    return NextResponse.json({ error: "POI not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const altText = typeof formData.get("altText") === "string" ? formData.get("altText") : "";
  const caption = typeof formData.get("caption") === "string" ? formData.get("caption") : "";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }

  const { data: existingRows, error: existingError } = await fetchPoiMediaRows(adminClient, poiId);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const storagePath = buildPoiMediaStoragePath(poiId, file.name || "image");
  const { error: uploadError } = await adminClient.storage
    .from(POI_MEDIA_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = adminClient.storage.from(POI_MEDIA_BUCKET).getPublicUrl(storagePath);

  const nextSortOrder = existingRows?.length ?? 0;
  const { data: insertedRow, error: insertError } = await adminClient
    .from("poi_media")
    .insert({
      poi_id: poiId,
      image_url: publicUrl,
      alt_text: altText || null,
      caption: caption || null,
      is_thumbnail: nextSortOrder === 0,
      sort_order: nextSortOrder,
      storage_path: storagePath,
    })
    .select("id, image_url, alt_text, caption, is_thumbnail, sort_order, storage_path")
    .single();

  if (insertError || !insertedRow) {
    await adminClient.storage.from(POI_MEDIA_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insertError?.message ?? "Unable to save image metadata." }, { status: 500 });
  }

  return NextResponse.json({ image: mapPoiMediaRecord(insertedRow) }, { status: 201 });
}

export async function PUT(request: Request, ctx: RouteContext<"/api/admin/pois/[poiId]/media">) {
  const access = await requireCuratorActor();

  if (!access.actor) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body: unknown = await request.json();

  if (!isPoiMediaSyncRequest(body)) {
    return NextResponse.json({ error: "Invalid media payload." }, { status: 400 });
  }

  const { poiId } = await ctx.params;
  const adminClient = createSupabaseAdminClient();
  const { data: existingRows, error: existingError } = await fetchPoiMediaRows(adminClient, poiId);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingIds = new Set((existingRows ?? []).map((image) => image.id));
  const hasExactImageSet =
    body.images.length === (existingRows?.length ?? 0) &&
    body.images.every((image) => existingIds.has(image.id));

  if (!hasExactImageSet) {
    return NextResponse.json({ error: "Media reorder payload must include every existing image exactly once." }, { status: 400 });
  }

  const { data: syncedRows, error: syncError } = await syncPoiMediaRows(adminClient, poiId, body.images);

  if (syncError) {
    return NextResponse.json({ error: syncError.message }, { status: 500 });
  }

  return NextResponse.json({ images: (syncedRows ?? []).map(mapPoiMediaRecord) });
}
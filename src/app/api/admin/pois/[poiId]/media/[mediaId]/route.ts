import { NextResponse } from "next/server";
import {
  mapPoiMediaRecord,
  normalizePoiMediaRows,
  POI_MEDIA_BUCKET,
} from "@/lib/admin/poi-media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCuratorActor } from "@/lib/supabase/auth";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/pois/[poiId]/media/[mediaId]">,
) {
  const access = await requireCuratorActor();

  if (!access.actor) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { poiId, mediaId } = await ctx.params;
  const adminClient = createSupabaseAdminClient();
  const { data: imageRow, error: imageError } = await adminClient
    .from("poi_media")
    .select("id, image_url, alt_text, caption, is_thumbnail, sort_order, storage_path")
    .eq("poi_id", poiId)
    .eq("id", mediaId)
    .maybeSingle();

  if (imageError) {
    return NextResponse.json({ error: imageError.message }, { status: 500 });
  }

  if (!imageRow) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  if (imageRow.storage_path) {
    const { error: storageError } = await adminClient.storage
      .from(POI_MEDIA_BUCKET)
      .remove([imageRow.storage_path]);

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await adminClient
    .from("poi_media")
    .delete()
    .eq("poi_id", poiId)
    .eq("id", mediaId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const { data: normalizedRows, error: normalizeError } = await normalizePoiMediaRows(adminClient, poiId);

  if (normalizeError) {
    return NextResponse.json({ error: normalizeError.message }, { status: 500 });
  }

  return NextResponse.json({ images: (normalizedRows ?? []).map(mapPoiMediaRecord) });
}
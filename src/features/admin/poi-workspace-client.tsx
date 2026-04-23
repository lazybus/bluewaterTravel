"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createEmptyPoiRecord,
  getRecordTypeLabel,
  recordTypeOptions,
  warningSeverities,
  warningTypes,
  type PoiEditorRecord,
  type PoiImageRecord,
  type PoiSummaryRecord,
} from "@/lib/admin/poi-records";

type GalleryImageState = PoiImageRecord & {
  clientId: string;
  file?: File;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body;
}

function createPersistedGalleryImage(image: PoiImageRecord): GalleryImageState {
  return {
    ...image,
    clientId: image.id ?? crypto.randomUUID(),
  };
}

function createStagedGalleryImage(file: File): GalleryImageState {
  return {
    clientId: crypto.randomUUID(),
    url: URL.createObjectURL(file),
    altText: "",
    caption: "",
    file,
  };
}

function revokeGalleryImagePreview(image: GalleryImageState) {
  if (image.file) {
    URL.revokeObjectURL(image.url);
  }
}

function toEditorImage(image: GalleryImageState): PoiImageRecord {
  return {
    id: image.id,
    url: image.url,
    altText: image.altText,
    caption: image.caption,
    storagePath: image.storagePath,
  };
}

function isPersistedGalleryImage(
  image: GalleryImageState,
): image is GalleryImageState & { id: string } {
  return typeof image.id === "string" && image.id.length > 0;
}

export function PoiWorkspaceClient() {
  const [pois, setPois] = useState<PoiSummaryRecord[]>([]);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [editor, setEditor] = useState<PoiEditorRecord>(createEmptyPoiRecord());
  const [galleryImages, setGalleryImages] = useState<GalleryImageState[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryImagesRef = useRef<GalleryImageState[]>([]);

  useEffect(() => {
    galleryImagesRef.current = galleryImages;
  }, [galleryImages]);

  useEffect(() => {
    void loadPois();
  }, []);

  useEffect(() => {
    return () => {
      galleryImagesRef.current.forEach(revokeGalleryImagePreview);
    };
  }, []);

  async function loadPois() {
    try {
      const payload = await parseResponse<{ pois: PoiSummaryRecord[] }>(
        await fetch("/api/admin/pois", { cache: "no-store" }),
      );
      setPois(payload.pois);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load POIs.");
    }
  }

  async function loadPoi(poiId: string) {
    try {
      const payload = await parseResponse<{ poi: PoiEditorRecord }>(
        await fetch(`/api/admin/pois/${poiId}`, { cache: "no-store" }),
      );
      replaceGalleryImages(payload.poi.images.map(createPersistedGalleryImage));
      setRemovedImageIds([]);
      setDraggedImageId(null);
      setSelectedPoiId(poiId);
      setEditor(payload.poi);
      setStatusMessage(null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load POI.");
    }
  }

  function replaceGalleryImages(nextImages: GalleryImageState[]) {
    galleryImagesRef.current.forEach(revokeGalleryImagePreview);
    galleryImagesRef.current = nextImages;
    setGalleryImages(nextImages);
  }

  function updateEditor(changes: Partial<PoiEditorRecord>) {
    setEditor((current) => ({ ...current, ...changes }));
  }

  function updateGalleryImage(clientId: string, changes: Partial<PoiImageRecord>) {
    setGalleryImages((current) =>
      current.map((image) => {
        if (image.clientId !== clientId) {
          return image;
        }

        return {
          ...image,
          ...changes,
        };
      }),
    );
  }

  function createNewPoi() {
    replaceGalleryImages([]);
    setRemovedImageIds([]);
    setDraggedImageId(null);
    setSelectedPoiId(null);
    setEditor(createEmptyPoiRecord());
    setStatusMessage("New draft ready.");
    setErrorMessage(null);
  }

  function updateHour(index: number, field: keyof PoiEditorRecord["hours"][number], value: string | boolean | number) {
    setEditor((current) => ({
      ...current,
      hours: current.hours.map((hour, currentIndex) => {
        if (currentIndex !== index) {
          return hour;
        }

        return {
          ...hour,
          [field]: value,
        };
      }),
    }));
  }

  function updateWarning(index: number, field: keyof PoiEditorRecord["warnings"][number], value: string | boolean) {
    setEditor((current) => ({
      ...current,
      warnings: current.warnings.map((warning, currentIndex) => {
        if (currentIndex !== index) {
          return warning;
        }

        return {
          ...warning,
          [field]: value,
        };
      }),
    }));
  }

  function addHour() {
    setEditor((current) => ({
      ...current,
      hours: [
        ...current.hours,
        {
          seasonLabel: "Summer",
          validFrom: "",
          validTo: "",
          dayOfWeek: 0,
          opensAt: "09:00",
          closesAt: "17:00",
          earlyCloseWarningMinutes: "",
          closed: false,
          notes: "",
        },
      ],
    }));
  }

  function addWarning() {
    setEditor((current) => ({
      ...current,
      warnings: [
        ...current.warnings,
        {
          warningType: "parking",
          severity: "warning",
          title: "",
          message: "",
          actionUrl: "",
          requiresAcknowledgement: false,
          leadTimeHours: "",
        },
      ],
    }));
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function queueGalleryFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setGalleryImages((current) => [
      ...current,
      ...files.map(createStagedGalleryImage),
    ]);
    setStatusMessage(selectedPoiId ? "Images queued for save." : "Images staged. Save the POI to upload them.");
    setErrorMessage(null);
    event.target.value = "";
  }

  function removeGalleryImage(clientId: string) {
    const imageToRemove = galleryImages.find((image) => image.clientId === clientId);

    if (!imageToRemove) {
      return;
    }

    if (imageToRemove.file) {
      revokeGalleryImagePreview(imageToRemove);
    }

    const imageId = imageToRemove.id;

    if (imageId) {
      setRemovedImageIds((current) =>
        current.includes(imageId) ? current : [...current, imageId],
      );
    }

    setGalleryImages((current) => current.filter((image) => image.clientId !== clientId));
  }

  function moveGalleryImage(sourceClientId: string, targetClientId: string) {
    if (sourceClientId === targetClientId) {
      return;
    }

    setGalleryImages((current) => {
      const sourceIndex = current.findIndex((image) => image.clientId === sourceClientId);
      const targetIndex = current.findIndex((image) => image.clientId === targetClientId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return current;
      }

      const nextImages = [...current];
      const [movedImage] = nextImages.splice(sourceIndex, 1);
      nextImages.splice(targetIndex, 0, movedImage);
      return nextImages;
    });
  }

  async function syncPoiImages(poiId: string) {
    let workingImages = [...galleryImages];

    for (const image of workingImages) {
      if (!image.file) {
        continue;
      }

      const formData = new FormData();
      formData.set("file", image.file);
      formData.set("altText", image.altText);
      formData.set("caption", image.caption);

      const payload = await parseResponse<{ image: PoiImageRecord }>(
        await fetch(`/api/admin/pois/${poiId}/media`, {
          method: "POST",
          body: formData,
        }),
      );

      revokeGalleryImagePreview(image);
      workingImages = workingImages.map((current) => {
        if (current.clientId !== image.clientId) {
          return current;
        }

        return {
          ...createPersistedGalleryImage(payload.image),
          clientId: image.clientId,
        };
      });
    }

    for (const mediaId of removedImageIds) {
      const response = await fetch(`/api/admin/pois/${poiId}/media/${mediaId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to remove image.");
      }
    }

    const syncPayload = await parseResponse<{ images: PoiImageRecord[] }>(
      await fetch(`/api/admin/pois/${poiId}/media`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images: workingImages
            .filter(isPersistedGalleryImage)
            .map((image) => ({
              id: image.id,
              altText: image.altText,
              caption: image.caption,
            })),
        }),
      }),
    );

    const nextImages = syncPayload.images.map(createPersistedGalleryImage);
    galleryImagesRef.current = nextImages;
    setGalleryImages(nextImages);
    setRemovedImageIds([]);
    setDraggedImageId(null);
    setEditor((current) => ({
      ...current,
      images: syncPayload.images,
    }));
  }

  function savePoi() {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(selectedPoiId ? `/api/admin/pois/${selectedPoiId}` : "/api/admin/pois", {
            method: selectedPoiId ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...editor,
              images: galleryImages.map(toEditorImage),
            }),
          });

          const payload = await parseResponse<{ id?: string }>(response);
          const nextPoiId = selectedPoiId ?? payload.id ?? null;

          if (nextPoiId) {
            await syncPoiImages(nextPoiId);
          }

          await loadPois();

          if (nextPoiId) {
            await loadPoi(nextPoiId);
          }

          setStatusMessage(selectedPoiId ? "POI updated." : "POI created.");
          setErrorMessage(null);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Save failed.");
        }
      })();
    });
  }

  function deletePoi() {
    if (!selectedPoiId) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/admin/pois/${selectedPoiId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const payload = (await response.json()) as { error?: string };
            throw new Error(payload.error ?? "Delete failed.");
          }

          await loadPois();
          replaceGalleryImages([]);
          setRemovedImageIds([]);
          setDraggedImageId(null);
          setSelectedPoiId(null);
          setEditor(createEmptyPoiRecord());
          setStatusMessage("POI deleted.");
          setErrorMessage(null);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Delete failed.");
        }
      })();
    });
  }

  function handleImageDragStart(clientId: string) {
    setDraggedImageId(clientId);
  }

  function handleImageDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleImageDrop(targetClientId: string) {
    if (!draggedImageId) {
      return;
    }

    moveGalleryImage(draggedImageId, targetClientId);
    setDraggedImageId(null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="card-surface rounded-[1.5rem] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">POI library</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Curated places</h2>
          </div>
          <button
            type="button"
            onClick={createNewPoi}
            className="rounded-full border border-line bg-white/70 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
          >
            New
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {pois.map((poi) => (
            <button
              key={poi.id}
              type="button"
              onClick={() => void loadPoi(poi.id)}
              className={`rounded-[1.25rem] border px-4 py-3 text-left transition ${selectedPoiId === poi.id ? "border-lagoon bg-white text-ink" : "border-line bg-white/60 text-ink-soft hover:bg-white"}`}
            >
              <p className="text-sm font-semibold text-ink">{poi.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-lagoon-strong">{getRecordTypeLabel(poi.poiKind)}</p>
              <p className="mt-2 text-sm">{poi.municipality || "Municipality pending"}</p>
            </button>
          ))}
          {pois.length === 0 && (
            <div className="rounded-[1.25rem] border border-dashed border-line px-4 py-5 text-sm leading-7 text-ink-soft">
              No curated POIs yet. Create the first record from the form.
            </div>
          )}
        </div>
      </aside>

      <section className="card-surface rounded-[1.5rem] p-5">
        <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Map point editor</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">
              {selectedPoiId ? `Editing ${editor.name || editor.slug}` : "Create a curated map point"}
            </h1>
          </div>
          <div className="text-sm text-ink-soft">
            {statusMessage && <p>{statusMessage}</p>}
            {errorMessage && <p className="text-[#9c2d2d]">{errorMessage}</p>}
          </div>
        </div>

        <div className="mt-5 grid gap-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-2 text-sm text-ink-soft">
              Name
              <input value={editor.name} onChange={(event) => updateEditor({ name: event.target.value })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            </label>
            <label className="grid gap-2 text-sm text-ink-soft">
              Slug
              <input value={editor.slug} onChange={(event) => updateEditor({ slug: event.target.value })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            </label>
            <label className="grid gap-2 text-sm text-ink-soft">
              Record type
              <select value={editor.poiKind} onChange={(event) => updateEditor({ poiKind: event.target.value as PoiEditorRecord["poiKind"] })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none">
                {recordTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-ink-soft xl:col-span-3">
              Summary
              <input value={editor.summary} onChange={(event) => updateEditor({ summary: event.target.value })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            </label>
            <label className="grid gap-2 text-sm text-ink-soft xl:col-span-3">
              Description
              <textarea value={editor.description} onChange={(event) => updateEditor({ description: event.target.value })} rows={4} className="rounded-[1.25rem] border border-line bg-white px-3 py-3 text-sm text-ink outline-none" />
            </label>
            <label className="grid gap-2 text-sm text-ink-soft">
              Latitude
              <input value={editor.latitude} onChange={(event) => updateEditor({ latitude: event.target.value })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            </label>
            <label className="grid gap-2 text-sm text-ink-soft">
              Longitude
              <input value={editor.longitude} onChange={(event) => updateEditor({ longitude: event.target.value })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            </label>
            <label className="grid gap-2 text-sm text-ink-soft">
              Municipality
              <input value={editor.municipality} onChange={(event) => updateEditor({ municipality: event.target.value })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            </label>
            <label className="grid gap-2 text-sm text-ink-soft xl:col-span-3">
              Address
              <input value={editor.address} onChange={(event) => updateEditor({ address: event.target.value })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            </label>
            <label className="grid gap-2 text-sm text-ink-soft">
              Phone
              <input value={editor.phone} onChange={(event) => updateEditor({ phone: event.target.value })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            </label>
            <label className="grid gap-2 text-sm text-ink-soft">
              Website
              <input value={editor.website} onChange={(event) => updateEditor({ website: event.target.value })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            </label>
            <label className="grid gap-2 text-sm text-ink-soft">
              Booking URL
              <input value={editor.bookingUrl} onChange={(event) => updateEditor({ bookingUrl: event.target.value })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            </label>
          </section>

          <section className="grid gap-4 rounded-[1.5rem] border border-line bg-white/50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow">Images</p>
                <p className="mt-2 text-sm leading-7 text-ink-soft">
                  Upload image files into Supabase Storage, drag to reorder them, and keep the first image as the thumbnail.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={queueGalleryFiles}
                  className="hidden"
                />
                <button type="button" onClick={openFilePicker} disabled={isPending} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60">
                  Add images
                </button>
              </div>
            </div>

            {!selectedPoiId && galleryImages.some((image) => image.file) && (
              <div className="rounded-[1.25rem] border border-dashed border-line bg-white px-4 py-3 text-sm text-ink-soft">
                New POIs stage selected files locally. Save once to create the record and upload the queued images.
              </div>
            )}

            <div className="grid gap-3">
              {galleryImages.length === 0 && (
                <div className="rounded-[1.25rem] border border-dashed border-line px-4 py-4 text-sm text-ink-soft">
                  No images added yet.
                </div>
              )}

              {galleryImages.map((image, index) => (
                <div
                  key={image.clientId}
                  draggable
                  onDragStart={() => handleImageDragStart(image.clientId)}
                  onDragEnd={() => setDraggedImageId(null)}
                  onDragOver={handleImageDragOver}
                  onDrop={() => handleImageDrop(image.clientId)}
                  className={`grid gap-4 rounded-[1.25rem] border bg-white px-4 py-4 lg:grid-cols-[220px_1fr] ${draggedImageId === image.clientId ? "border-lagoon shadow-[0_0_0_1px_rgba(19,94,121,0.18)]" : "border-line"}`}
                >
                  <div className="grid gap-3">
                    <div className="relative overflow-hidden rounded-[1.25rem] border border-line bg-sand/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt={image.altText || ""} className="aspect-[4/3] h-full w-full object-cover" />
                      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                        {index === 0 && (
                          <span className="rounded-full bg-lagoon px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-foam">
                            Thumbnail
                          </span>
                        )}
                        {image.file && (
                          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                            Staged
                          </span>
                        )}
                        {!image.file && !image.storagePath && (
                          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                            Legacy URL
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">
                      Drag to reorder. The first image is always used as the POI thumbnail.
                    </p>
                  </div>

                  <div className="grid gap-3 content-start">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">Image {index + 1}</p>
                      <button type="button" onClick={() => removeGalleryImage(image.clientId)} className="rounded-full border border-[#b95c5c] bg-white px-4 py-2 text-sm font-semibold text-[#9c2d2d]">
                        Remove
                      </button>
                    </div>
                    <label className="grid gap-2 text-sm text-ink-soft">
                      Alt text
                      <input
                        value={image.altText}
                        onChange={(event) => updateGalleryImage(image.clientId, { altText: event.target.value })}
                        placeholder="Describe the image for accessibility"
                        className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-ink-soft">
                      Caption
                      <input
                        value={image.caption}
                        onChange={(event) => updateGalleryImage(image.clientId, { caption: event.target.value })}
                        placeholder="Optional gallery caption"
                        className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none"
                      />
                    </label>
                    <div className="rounded-[1.25rem] border border-line bg-sand/30 px-4 py-3 text-sm text-ink-soft break-all">
                      {image.file ? image.file.name : image.url}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 rounded-[1.5rem] border border-line bg-white/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Hours</p>
                <p className="mt-2 text-sm leading-7 text-ink-soft">Seasonal schedules and early-close warnings.</p>
              </div>
              <button type="button" onClick={addHour} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink">Add row</button>
            </div>
            {editor.hours.map((hour, index) => (
              <div key={hour.id ?? `hour-${index}`} className="grid gap-3 rounded-[1.25rem] border border-line bg-white px-4 py-4 md:grid-cols-4 xl:grid-cols-8">
                <input value={hour.seasonLabel} onChange={(event) => updateHour(index, "seasonLabel", event.target.value)} placeholder="Season" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
                <input value={hour.validFrom} onChange={(event) => updateHour(index, "validFrom", event.target.value)} type="date" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
                <input value={hour.validTo} onChange={(event) => updateHour(index, "validTo", event.target.value)} type="date" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
                <input value={hour.dayOfWeek} onChange={(event) => updateHour(index, "dayOfWeek", Number.parseInt(event.target.value, 10) || 0)} type="number" min={0} max={6} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
                <input value={hour.opensAt} onChange={(event) => updateHour(index, "opensAt", event.target.value)} type="time" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
                <input value={hour.closesAt} onChange={(event) => updateHour(index, "closesAt", event.target.value)} type="time" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
                <input value={hour.earlyCloseWarningMinutes} onChange={(event) => updateHour(index, "earlyCloseWarningMinutes", event.target.value)} placeholder="Warning mins" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
                <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft">
                  <input checked={hour.closed} onChange={(event) => updateHour(index, "closed", event.target.checked)} type="checkbox" />
                  Closed
                </label>
              </div>
            ))}
          </section>

          <section className="grid gap-4 rounded-[1.5rem] border border-line bg-white/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Warnings</p>
                <p className="mt-2 text-sm leading-7 text-ink-soft">Reservation, ferry, parking, or seasonal red-tape notices.</p>
              </div>
              <button type="button" onClick={addWarning} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink">Add warning</button>
            </div>
            {editor.warnings.map((warning, index) => (
              <div key={warning.id ?? `warning-${index}`} className="grid gap-3 rounded-[1.25rem] border border-line bg-white px-4 py-4 xl:grid-cols-2">
                <select value={warning.warningType} onChange={(event) => updateWarning(index, "warningType", event.target.value)} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none">
                  {warningTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select value={warning.severity} onChange={(event) => updateWarning(index, "severity", event.target.value)} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none">
                  {warningSeverities.map((severity) => (
                    <option key={severity} value={severity}>{severity}</option>
                  ))}
                </select>
                <input value={warning.title} onChange={(event) => updateWarning(index, "title", event.target.value)} placeholder="Warning title" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none xl:col-span-2" />
                <textarea value={warning.message} onChange={(event) => updateWarning(index, "message", event.target.value)} rows={3} placeholder="Warning message" className="rounded-[1.25rem] border border-line bg-white px-3 py-3 text-sm text-ink outline-none xl:col-span-2" />
                <input value={warning.actionUrl} onChange={(event) => updateWarning(index, "actionUrl", event.target.value)} placeholder="Action URL" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
                <input value={warning.leadTimeHours} onChange={(event) => updateWarning(index, "leadTimeHours", event.target.value)} placeholder="Lead time hours" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
                <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft xl:col-span-2">
                  <input checked={warning.requiresAcknowledgement} onChange={(event) => updateWarning(index, "requiresAcknowledgement", event.target.checked)} type="checkbox" />
                  Requires acknowledgement in itinerary builder
                </label>
              </div>
            ))}
          </section>

          <section className="grid gap-4 rounded-[1.5rem] border border-line bg-white/50 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2 xl:col-span-4">
              <p className="eyebrow">Activity metadata</p>
              <p className="mt-2 text-sm leading-7 text-ink-soft">This is the first data the itinerary validator can consume directly.</p>
            </div>
            <input value={editor.activityProfile.defaultDurationMinutes} onChange={(event) => setEditor((current) => ({ ...current, activityProfile: { ...current.activityProfile, defaultDurationMinutes: event.target.value } }))} placeholder="Default duration minutes" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            <input value={editor.activityProfile.minDurationMinutes} onChange={(event) => setEditor((current) => ({ ...current, activityProfile: { ...current.activityProfile, minDurationMinutes: event.target.value } }))} placeholder="Minimum duration" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            <input value={editor.activityProfile.maxDurationMinutes} onChange={(event) => setEditor((current) => ({ ...current, activityProfile: { ...current.activityProfile, maxDurationMinutes: event.target.value } }))} placeholder="Maximum duration" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            <input value={editor.activityProfile.trailDifficulty} onChange={(event) => setEditor((current) => ({ ...current, activityProfile: { ...current.activityProfile, trailDifficulty: event.target.value } }))} placeholder="Trail difficulty" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            <input value={editor.activityProfile.distanceKm} onChange={(event) => setEditor((current) => ({ ...current, activityProfile: { ...current.activityProfile, distanceKm: event.target.value } }))} placeholder="Distance km" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            <input value={editor.activityProfile.elevationGainM} onChange={(event) => setEditor((current) => ({ ...current, activityProfile: { ...current.activityProfile, elevationGainM: event.target.value } }))} placeholder="Elevation gain m" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            <input value={editor.activityProfile.crowdIntensity} onChange={(event) => setEditor((current) => ({ ...current, activityProfile: { ...current.activityProfile, crowdIntensity: event.target.value } }))} placeholder="Crowd intensity" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
            <input value={editor.activityProfile.weatherSensitivity} onChange={(event) => setEditor((current) => ({ ...current, activityProfile: { ...current.activityProfile, weatherSensitivity: event.target.value } }))} placeholder="Weather sensitivity" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
          </section>

          {editor.poiKind === "food" && (
            <section className="grid gap-4 rounded-[1.5rem] border border-line bg-white/50 p-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="md:col-span-2 xl:col-span-4">
                <p className="eyebrow">Food metadata</p>
                <p className="mt-2 text-sm leading-7 text-ink-soft">Restaurant-specific planning data for dining stops.</p>
              </div>
              <input value={editor.foodProfile.cuisineTypes} onChange={(event) => setEditor((current) => ({ ...current, foodProfile: { ...current.foodProfile, cuisineTypes: event.target.value } }))} placeholder="Cuisine types, comma separated" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none xl:col-span-2" />
              <input value={editor.foodProfile.diningStyle} onChange={(event) => setEditor((current) => ({ ...current, foodProfile: { ...current.foodProfile, diningStyle: event.target.value } }))} placeholder="Dining style" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
              <input value={editor.foodProfile.priceBand} onChange={(event) => setEditor((current) => ({ ...current, foodProfile: { ...current.foodProfile, priceBand: event.target.value } }))} placeholder="Price band" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
              <input value={editor.foodProfile.menuUrl} onChange={(event) => setEditor((current) => ({ ...current, foodProfile: { ...current.foodProfile, menuUrl: event.target.value } }))} placeholder="Menu URL" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none xl:col-span-2" />
              <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft"><input checked={editor.foodProfile.patio} onChange={(event) => setEditor((current) => ({ ...current, foodProfile: { ...current.foodProfile, patio: event.target.checked } }))} type="checkbox" /> Patio</label>
              <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft"><input checked={editor.foodProfile.takeoutAvailable} onChange={(event) => setEditor((current) => ({ ...current, foodProfile: { ...current.foodProfile, takeoutAvailable: event.target.checked } }))} type="checkbox" /> Takeout available</label>
              <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft"><input checked={editor.foodProfile.reservationRecommended} onChange={(event) => setEditor((current) => ({ ...current, foodProfile: { ...current.foodProfile, reservationRecommended: event.target.checked } }))} type="checkbox" /> Reservation recommended</label>
            </section>
          )}

          {editor.poiKind === "accommodation" && (
            <section className="grid gap-4 rounded-[1.5rem] border border-line bg-white/50 p-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="md:col-span-2 xl:col-span-4">
                <p className="eyebrow">Accommodation metadata</p>
                <p className="mt-2 text-sm leading-7 text-ink-soft">Capacity and stay-type fields for lodging stops.</p>
              </div>
              <input value={editor.accommodationProfile.accommodationType} onChange={(event) => setEditor((current) => ({ ...current, accommodationProfile: { ...current.accommodationProfile, accommodationType: event.target.value } }))} placeholder="Accommodation type" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
              <input value={editor.accommodationProfile.capacityMin} onChange={(event) => setEditor((current) => ({ ...current, accommodationProfile: { ...current.accommodationProfile, capacityMin: event.target.value } }))} placeholder="Minimum capacity" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
              <input value={editor.accommodationProfile.capacityMax} onChange={(event) => setEditor((current) => ({ ...current, accommodationProfile: { ...current.accommodationProfile, capacityMax: event.target.value } }))} placeholder="Maximum capacity" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
              <div className="grid gap-3 xl:col-span-4 xl:grid-cols-4">
                <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft"><input checked={editor.accommodationProfile.roofed} onChange={(event) => setEditor((current) => ({ ...current, accommodationProfile: { ...current.accommodationProfile, roofed: event.target.checked } }))} type="checkbox" /> Roofed</label>
                <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft"><input checked={editor.accommodationProfile.glamping} onChange={(event) => setEditor((current) => ({ ...current, accommodationProfile: { ...current.accommodationProfile, glamping: event.target.checked } }))} type="checkbox" /> Glamping</label>
                <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft"><input checked={editor.accommodationProfile.camping} onChange={(event) => setEditor((current) => ({ ...current, accommodationProfile: { ...current.accommodationProfile, camping: event.target.checked } }))} type="checkbox" /> Camping</label>
                <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft"><input checked={editor.accommodationProfile.directBooking} onChange={(event) => setEditor((current) => ({ ...current, accommodationProfile: { ...current.accommodationProfile, directBooking: event.target.checked } }))} type="checkbox" /> Direct booking</label>
              </div>
            </section>
          )}

          {editor.poiKind === "logistics" && (
            <section className="grid gap-4 rounded-[1.5rem] border border-line bg-white/50 p-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="md:col-span-2 xl:col-span-4">
                <p className="eyebrow">Logistics metadata</p>
                <p className="mt-2 text-sm leading-7 text-ink-soft">Fuel, charging, water, and survival-layer details.</p>
              </div>
              <input value={editor.logisticsProfile.logisticsType} onChange={(event) => setEditor((current) => ({ ...current, logisticsProfile: { ...current.logisticsProfile, logisticsType: event.target.value } }))} placeholder="Logistics type" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
              <input value={editor.logisticsProfile.fuelTypes} onChange={(event) => setEditor((current) => ({ ...current, logisticsProfile: { ...current.logisticsProfile, fuelTypes: event.target.value } }))} placeholder="Fuel types, comma separated" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none xl:col-span-2" />
              <input value={editor.logisticsProfile.chargerTypes} onChange={(event) => setEditor((current) => ({ ...current, logisticsProfile: { ...current.logisticsProfile, chargerTypes: event.target.value } }))} placeholder="Charger types, comma separated" className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none" />
              <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft"><input checked={editor.logisticsProfile.potableWater} onChange={(event) => setEditor((current) => ({ ...current, logisticsProfile: { ...current.logisticsProfile, potableWater: event.target.checked } }))} type="checkbox" /> Potable water</label>
              <textarea value={editor.logisticsProfile.seasonalNotes} onChange={(event) => setEditor((current) => ({ ...current, logisticsProfile: { ...current.logisticsProfile, seasonalNotes: event.target.value } }))} rows={3} placeholder="Seasonal logistics notes" className="rounded-[1.25rem] border border-line bg-white px-3 py-3 text-sm text-ink outline-none md:col-span-2 xl:col-span-4" />
            </section>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 md:flex-row md:items-center md:justify-between">
          <p className="text-sm leading-7 text-ink-soft">
            Admin routes require an authenticated curator or admin session. Without one,
            the UI will surface the authorization error from the backend.
          </p>
          <div className="flex gap-3">
            {selectedPoiId && (
              <button type="button" onClick={deletePoi} disabled={isPending} className="rounded-full border border-[#b95c5c] bg-white px-5 py-3 text-sm font-semibold text-[#9c2d2d] transition hover:bg-[#fff3f3] disabled:opacity-60">
                Delete
              </button>
            )}
            <button type="button" onClick={savePoi} disabled={isPending} className="rounded-full bg-lagoon px-5 py-3 text-sm font-semibold text-foam transition hover:bg-lagoon-strong disabled:opacity-60">
              {isPending ? "Saving..." : selectedPoiId ? "Save changes" : "Create POI"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
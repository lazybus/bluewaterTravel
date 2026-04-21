"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createEmptyPoiRecord,
  poiKinds,
  warningSeverities,
  warningTypes,
  type PoiEditorRecord,
  type PoiSummaryRecord,
} from "@/lib/admin/poi-records";

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body;
}

export function PoiWorkspaceClient() {
  const [pois, setPois] = useState<PoiSummaryRecord[]>([]);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [editor, setEditor] = useState<PoiEditorRecord>(createEmptyPoiRecord());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void loadPois();
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
      setSelectedPoiId(poiId);
      setEditor(payload.poi);
      setStatusMessage(null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load POI.");
    }
  }

  function updateEditor(changes: Partial<PoiEditorRecord>) {
    setEditor((current) => ({ ...current, ...changes }));
  }

  function createNewPoi() {
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

  function savePoi() {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(selectedPoiId ? `/api/admin/pois/${selectedPoiId}` : "/api/admin/pois", {
            method: selectedPoiId ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(editor),
          });

          const payload = await parseResponse<{ id?: string }>(response);
          const nextPoiId = selectedPoiId ?? payload.id ?? null;

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
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-lagoon-strong">{poi.poiKind}</p>
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
            <p className="eyebrow">POI editor</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">
              {selectedPoiId ? `Editing ${editor.name || editor.slug}` : "Create a curated POI"}
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
              Type
              <select value={editor.poiKind} onChange={(event) => updateEditor({ poiKind: event.target.value as PoiEditorRecord["poiKind"] })} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none">
                {poiKinds.map((poiKind) => (
                  <option key={poiKind} value={poiKind}>{poiKind}</option>
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
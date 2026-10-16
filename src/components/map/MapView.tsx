"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Event } from "@/lib/types";
import { REGIONS, SIGNIFICANCE_LEVELS, TOPICS } from "@/lib/types";
import { useApi } from "@/hooks/useApi";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select, Label } from "@/components/ui/Input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { EventCard } from "@/components/domain/EventCard";
import { EventDetailModal } from "@/components/domain/EventDetailModal";
import { Spinner } from "@/components/ui/States";

// Lazy: the map (and Leaflet) only download when this page is used.
const WorldMap = dynamic(() => import("@/components/map/WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-lg border border-line bg-surface-2 md:h-[560px]">
      <Spinner className="h-6 w-6" />
    </div>
  ),
});

export function MapView({
  tileUrl,
  tileAttribution,
  center,
}: {
  tileUrl?: string;
  tileAttribution?: string;
  center?: [number, number];
}) {
  const [topic, setTopic] = useState("");
  const [region, setRegion] = useState("");
  const [level, setLevel] = useState("");
  const [hours, setHours] = useState("168");
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const params = new URLSearchParams({ limit: "200" });
  if (topic) params.set("topic", topic);
  if (region) params.set("region", region);
  if (level) params.set("level", level);
  if (hours) params.set("hours", hours);

  const { data, error, loading, refetch } = useApi<{ events: Event[]; total: number }>(
    `/api/events?${params.toString()}`,
  );

  const events = useMemo(() => data?.events ?? [], [data]);
  const mappable = useMemo(
    () => events.filter((e) => typeof e.primaryGeo.lat === "number" && typeof e.primaryGeo.lng === "number"),
    [events],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">World Map</h1>
        <p className="text-sm text-muted">
          Only events with real ingested coordinates appear. Country-level events are shown as
          approximate areas, never as precise points.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="map-topic">Topic</Label>
            <Select id="map-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">All topics</option>
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/-/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="map-region">Region</Label>
            <Select id="map-region" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">All regions</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/-/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="map-level">Significance</Label>
            <Select id="map-level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All levels</option>
              {SIGNIFICANCE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="map-hours">Time window</Label>
            <Select id="map-hours" value={hours} onChange={(e) => setHours(e.target.value)}>
              <option value="24">Last 24 hours</option>
              <option value="72">Last 3 days</option>
              <option value="168">Last 7 days</option>
              <option value="720">Last 30 days</option>
              <option value="">All retained data</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? <LoadingState label="Loading events…" /> : null}
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ErrorBoundary fallbackTitle="The map could not be displayed. All data remains available in the list and other views.">
              <WorldMap
                events={mappable}
                onSelect={(e) => setOpenEventId(e.id)}
                tileUrl={tileUrl}
                tileAttribution={tileAttribution}
                initialCenter={center}
              />
            </ErrorBoundary>
            <p className="mt-1.5 text-[11px] text-muted">
              {mappable.length} of {events.length} filtered events are geolocated.{" "}
              {events.length - mappable.length > 0
                ? `${events.length - mappable.length} event(s) have no reliable location and are listed only.`
                : null}
            </p>
          </div>
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Events in view</CardTitle>
              <Badge tone="neutral">{events.length}</Badge>
            </CardHeader>
            <CardContent className="max-h-[520px] space-y-2 overflow-y-auto">
              {events.length === 0 ? (
                <EmptyState
                  title="No events match the filters"
                  description="Widen the time window or clear topic/region filters."
                />
              ) : (
                events.slice(0, 40).map((e) => (
                  <EventCard key={e.id} event={e} onOpen={(ev) => setOpenEventId(ev.id)} />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {openEventId ? (
        <EventDetailModal eventId={openEventId} onClose={() => setOpenEventId(null)} />
      ) : null}
    </div>
  );
}

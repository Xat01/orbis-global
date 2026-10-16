"use client";

import { useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Event } from "@/lib/types";

// ---------------------------------------------------------------------------
// World map.
//
// Honesty rules:
//   - only events with real coordinates are plotted
//   - country/region-level events are drawn as large translucent area circles,
//     never as precise pins
//   - the map is lazy-loaded and entirely optional: if it fails, every other
//     view of ORBIS still works.
// ---------------------------------------------------------------------------

const PRECISION_STYLE: Record<string, { radius: number; opacity: number; dash?: string }> = {
  exact: { radius: 6, opacity: 0.9 },
  city: { radius: 7, opacity: 0.75 },
  admin: { radius: 10, opacity: 0.4 },
  country: { radius: 14, opacity: 0.18, dash: "3 3" },
  region: { radius: 18, opacity: 0.14, dash: "3 3" },
};

const LEVEL_COLOR: Record<string, string> = {
  critical: "#b91c1c",
  notable: "#b45309",
  routine: "#059669",
};

interface Cluster {
  lat: number;
  lng: number;
  events: Event[];
}

function ZoomListener({ onZoom }: { onZoom: (z: number) => void }) {
  useMapEvents({
    zoomend: (e) => onZoom(e.target.getZoom()),
  });
  return null;
}

/** Greedy grid clustering that scales with zoom level. */
function clusterEvents(events: Event[], zoom: number): Cluster[] {
  const cell = Math.max(40 / Math.pow(2, Math.max(zoom - 1, 0)), 0.01);
  const grid = new Map<string, Cluster>();
  for (const e of events) {
    const lat = e.primaryGeo.lat!;
    const lng = e.primaryGeo.lng!;
    const key = `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`;
    const existing = grid.get(key);
    if (existing) existing.events.push(e);
    else grid.set(key, { lat, lng, events: [e] });
  }
  return [...grid.values()];
}

export default function WorldMap({
  events,
  onSelect,
  tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution = "© OpenStreetMap contributors",
  initialCenter = [22, 10],
  initialZoom = 2,
}: {
  events: Event[];
  onSelect: (event: Event) => void;
  tileUrl?: string;
  tileAttribution?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
}) {
  const [zoom, setZoom] = useState(initialZoom);

  const mappable = useMemo(
    () =>
      events
        .filter((e) => typeof e.primaryGeo.lat === "number" && typeof e.primaryGeo.lng === "number")
        .slice(0, 400),
    [events],
  );

  const clusters = useMemo(() => clusterEvents(mappable, zoom), [mappable, zoom]);

  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      className="h-[420px] w-full rounded-lg md:h-[560px]"
      scrollWheelZoom
      aria-label="World map of geolocated events"
    >
      <TileLayer url={tileUrl} attribution={tileAttribution} />
      <ZoomListener onZoom={setZoom} />
      {clusters.map((c) => {
        if (c.events.length > 1) {
          const maxLevel = c.events.reduce(
            (acc, e) => (e.significance.level === "critical" ? "critical" : acc === "critical" ? acc : e.significance.level === "notable" ? "notable" : acc),
            "routine" as string,
          );
          const radius = Math.min(10 + Math.log2(c.events.length) * 4, 26);
          return (
            <CircleMarker
              key={`${c.lat}-${c.lng}-${c.events.length}`}
              center={[c.lat, c.lng]}
              radius={radius}
              pathOptions={{
                color: LEVEL_COLOR[maxLevel] ?? "#059669",
                fillColor: LEVEL_COLOR[maxLevel] ?? "#059669",
                fillOpacity: 0.25,
                weight: 1.5,
              }}
              eventHandlers={{
                click: () =>
                  onSelect(
                    [...c.events].sort((a, b) => b.significance.score - a.significance.score)[0],
                  ),
              }}
            >
              <Tooltip>
                <strong>{c.events.length} events</strong>
                <br />
                Click for the most significant
              </Tooltip>
            </CircleMarker>
          );
        }
        const e = c.events[0];
        const style = PRECISION_STYLE[e.primaryGeo.kind] ?? PRECISION_STYLE.city;
        return (
          <CircleMarker
            key={e.id}
            center={[e.primaryGeo.lat!, e.primaryGeo.lng!]}
            radius={style.radius}
            pathOptions={{
              color: LEVEL_COLOR[e.significance.level] ?? "#059669",
              fillColor: LEVEL_COLOR[e.significance.level] ?? "#059669",
              fillOpacity: style.opacity,
              weight: 1.5,
              dashArray: style.dash,
            }}
            eventHandlers={{ click: () => onSelect(e) }}
          >
            <Tooltip>
              <strong>{e.title}</strong>
              <br />
              {e.primaryGeo.name}
              {e.primaryGeo.kind === "country" || e.primaryGeo.kind === "region"
                ? " (approximate area)"
                : ""}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

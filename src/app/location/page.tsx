"use client";

import { useMemo, useState } from "react";
import { MapPin, Navigation, Trash2, Check, Info } from "lucide-react";
import type { Event, Region } from "@/lib/types";
import { CITIES, COUNTRIES, nearestPlace } from "@/lib/geo/gazetteer";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { EventCard } from "@/components/domain/EventCard";
import { EventDetailModal } from "@/components/domain/EventDetailModal";
import { scoreEventForUser } from "@/lib/personalization/relevance";

interface PlaceOption {
  name: string;
  country: string;
  region: Region;
  lat: number;
  lng: number;
  kind: "city" | "country";
}

const ALL_PLACES: PlaceOption[] = [
  ...CITIES.map((c) => ({
    name: c.name,
    country: c.country,
    region: (COUNTRIES.find((k) => k.name === c.country)?.region ?? "global") as Region,
    lat: c.lat,
    lng: c.lng,
    kind: "city" as const,
  })),
  ...COUNTRIES.map((c) => ({
    name: c.name,
    country: c.name,
    region: c.region,
    lat: c.lat,
    lng: c.lng,
    kind: "country" as const,
  })),
];

export default function LocationPage() {
  const { prefs, setLocation, clearLocation, hydrated } = usePreferences();
  const [query, setQuery] = useState("");
  const [geoState, setGeoState] = useState<"idle" | "requesting" | "denied" | "failed" | "unsupported">("idle");
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const { data, error, loading, refetch } = useApi<{ events: Event[] }>("/api/events?limit=60");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return ALL_PLACES.filter(
      (p) => p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q),
    )
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }, [query]);

  const nearby = useMemo(() => {
    if (!data || !prefs.location) return [];
    return [...data.events]
      .filter((e) => {
        const r = scoreEventForUser(e, prefs);
        return r.nearUserLocation || r.sameCountry;
      })
      .sort(
        (a, b) =>
          scoreEventForUser(b, prefs).score - scoreEventForUser(a, prefs).score,
      )
      .slice(0, 8);
  }, [data, prefs]);

  function requestBrowserLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("unsupported");
      return;
    }
    setGeoState("requesting");
    setGeoMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const place = nearestPlace(pos.coords.latitude, pos.coords.longitude);
        if (!place) {
          setGeoState("failed");
          setGeoMessage(
            "Your position could not be matched to a known place in the ORBIS gazetteer. Please choose a location manually.",
          );
          return;
        }
        setLocation({
          name: place.name,
          country: place.country,
          region: place.region,
          lat: place.lat,
          lng: place.lng,
          precision: place.name === place.country ? "country" : "city",
        });
        setGeoState("idle");
        setGeoMessage(
          `Detected nearest known place: ${place.name}, ${place.country}. Only this approximate place is stored in your browser — raw coordinates are discarded.`,
        );
      },
      (err) => {
        setGeoState(err.code === err.PERMISSION_DENIED ? "denied" : "failed");
        setGeoMessage(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can select a location manually instead."
            : "Your location could not be determined. You can select a location manually instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">My Location</h1>
        <p className="text-sm text-muted">
          Prioritise developments near a place you care about. Everything stays in this browser.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Select a location</CardTitle>
            {hydrated && prefs.location ? (
              <Button variant="ghost" size="sm" onClick={clearLocation}>
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {hydrated && prefs.location ? (
              <div className="rounded border border-accent/40 bg-emerald-50 p-2.5">
                <div className="flex items-center gap-1.5 text-sm font-medium text-accent-2">
                  <Check className="h-4 w-4" /> {prefs.location.name}
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {prefs.location.country} · {prefs.location.region.replace(/-/g, " ")} ·{" "}
                  {prefs.location.precision}-level
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted">
                No location selected. ORBIS is usable without personalisation — the global overview
                still works.
              </p>
            )}

            <div>
              <label htmlFor="place-search" className="mb-1 block text-xs font-medium text-muted">
                Search city, region or country
              </label>
              <Input
                id="place-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Nairobi, France, Tokyo"
                aria-describedby="place-search-help"
              />
              <p id="place-search-help" className="mt-1 text-[11px] text-muted">
                Matches city names and countries from a built-in gazetteer.
              </p>
            </div>

            {results.length > 0 ? (
              <ul className="max-h-64 space-y-1 overflow-y-auto" role="listbox" aria-label="Location results">
                {results.map((p) => (
                  <li key={`${p.kind}-${p.name}`}>
                    <button
                      className="flex w-full items-center gap-2 rounded border border-line px-2 py-1.5 text-left text-sm hover:border-accent hover:bg-surface-2"
                      onClick={() =>
                        setLocation({
                          name: p.name,
                          country: p.country,
                          region: p.region,
                          lat: p.lat,
                          lng: p.lng,
                          precision: p.kind,
                        })
                      }
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="flex-1">
                        <span className="block text-ink">{p.name}</span>
                        <span className="block text-[11px] text-muted">
                          {p.kind === "country" ? "Country" : "City"} · {p.country}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.trim().length >= 2 ? (
              <p className="text-xs text-muted">No matches. Try a different spelling.</p>
            ) : null}

            <div className="rounded border border-line bg-surface-2/60 p-2.5">
              <div className="flex items-center gap-1.5">
                <Navigation className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-medium text-ink">Use my device location</span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Your browser will ask permission first. ORBIS converts the position to the nearest
                known city and stores only that — raw GPS coordinates are never saved or sent
                anywhere.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={requestBrowserLocation}
                disabled={geoState === "requesting"}
              >
                {geoState === "requesting" ? "Requesting…" : "Use my location"}
              </Button>
              {geoMessage ? (
                <p
                  className={`mt-2 text-[11px] ${geoState === "idle" ? "text-accent-2" : "text-warning"}`}
                  role="status"
                >
                  {geoMessage}
                </p>
              ) : null}
            </div>

            <p className="flex items-start gap-1.5 text-[11px] text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Location preferences are stored in this browser&apos;s localStorage only. You can
              clear them at any time or from Settings.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              Relevant developments{" "}
              {prefs.location ? `around ${prefs.location.name}` : "(select a location)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? <LoadingState /> : null}
            {error ? <ErrorState error={error} onRetry={refetch} /> : null}
            {data && !prefs.location ? (
              <EmptyState
                title="No location selected"
                description="Pick a city or country to see location-weighted developments. “Near you” is only claimed when an event matches at city level."
              />
            ) : null}
            {data && prefs.location && nearby.length === 0 ? (
              <EmptyState
                title={`No events currently match ${prefs.location.name}`}
                description="Nothing in the current ingested data is located in your selected country or city. Global coverage continues in other views."
              />
            ) : null}
            {nearby.map((e) => {
              const rel = scoreEventForUser(e, prefs);
              return (
                <EventCard
                  key={e.id}
                  event={e}
                  onOpen={(ev) => setOpenEventId(ev.id)}
                  badge={
                    rel.nearUserLocation ? (
                      <Badge tone="dark">city-level match</Badge>
                    ) : (
                      <Badge tone="green">country-level match</Badge>
                    )
                  }
                />
              );
            })}
          </CardContent>
        </Card>
      </div>

      {openEventId ? (
        <EventDetailModal eventId={openEventId} onClose={() => setOpenEventId(null)} />
      ) : null}
    </div>
  );
}

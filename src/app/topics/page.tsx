"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Event, Region, Topic } from "@/lib/types";
import { useApi } from "@/hooks/useApi";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { EventCard } from "@/components/domain/EventCard";
import { EventDetailModal } from "@/components/domain/EventDetailModal";

export default function TopicsPage() {
  const { data, error, loading, refetch } = useApi<{ events: Event[] }>("/api/events?limit=200");
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const events = useMemo(() => data?.events ?? [], [data]);

  // Only expose regions/topics that actually carry data.
  const regionCounts = useMemo(() => {
    const map = new Map<Region, number>();
    for (const e of events) {
      const r = (e.primaryGeo.region ?? "global") as Region;
      map.set(r, (map.get(r) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const topicCounts = useMemo(() => {
    const map = new Map<Topic, number>();
    for (const e of events) {
      for (const t of e.categories) map.set(t, (map.get(t) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (selectedRegion && (e.primaryGeo.region ?? "global") !== selectedRegion) return false;
        if (selectedTopic && !e.categories.includes(selectedTopic)) return false;
        return true;
      }),
    [events, selectedRegion, selectedTopic],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Topics &amp; Regions</h1>
        <p className="text-sm text-muted">
          Only categories with current data are shown. Counts are grouped events, not article
          volume.
        </p>
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Regions with data</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {regionCounts.length === 0 ? (
                <EmptyState title="No regional data ingested yet" />
              ) : (
                <>
                  {regionCounts.map(([region, count]) => (
                    <button
                      key={region}
                      onClick={() =>
                        setSelectedRegion(selectedRegion === region ? null : region)
                      }
                      aria-pressed={selectedRegion === region}
                      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                        selectedRegion === region
                          ? "border-forest bg-forest text-white"
                          : "border-line bg-surface text-ink hover:bg-surface-2"
                      }`}
                    >
                      {region.replace(/-/g, " ")} · {count}
                    </button>
                  ))}
                  {selectedRegion ? (
                    <button
                      onClick={() => setSelectedRegion(null)}
                      className="rounded-md px-2 py-1.5 text-xs text-muted hover:text-ink"
                    >
                      clear
                    </button>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Topics with data</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {topicCounts.map(([topic, count]) => (
                <div key={topic} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedTopic(selectedTopic === topic ? null : topic)}
                    aria-pressed={selectedTopic === topic}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                      selectedTopic === topic
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-surface text-ink hover:bg-surface-2"
                    }`}
                  >
                    {topic.replace(/-/g, " ")} · {count}
                  </button>
                  <Link
                    href={`/news?topic=${topic}`}
                    className="text-[10px] text-muted hover:text-accent"
                    title="See underlying reports"
                  >
                    reports →
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">
                {filtered.length} event{filtered.length === 1 ? "" : "s"}
              </h2>
              {selectedRegion ? <Badge tone="dark">{selectedRegion.replace(/-/g, " ")}</Badge> : null}
              {selectedTopic ? <Badge tone="green">{selectedTopic.replace(/-/g, " ")}</Badge> : null}
            </div>
            {filtered.length === 0 ? (
              <EmptyState
                title="Nothing matches this combination"
                description="Clear one of the selections, or browse the full overview."
              />
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {filtered.slice(0, 30).map((e) => (
                  <EventCard key={e.id} event={e} onOpen={(ev) => setOpenEventId(ev.id)} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {openEventId ? (
        <EventDetailModal eventId={openEventId} onClose={() => setOpenEventId(null)} />
      ) : null}
    </div>
  );
}

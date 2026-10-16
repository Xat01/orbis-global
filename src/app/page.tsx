"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Event } from "@/lib/types";
import { useApi } from "@/hooks/useApi";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { compareByRelevance, scoreEventForUser } from "@/lib/personalization/relevance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { EventCard } from "@/components/domain/EventCard";
import { EventDetailModal } from "@/components/domain/EventDetailModal";
import { ArticlesOverTimeChart, EventsByRegionChart } from "@/components/charts/OverviewCharts";
import { relativeTime } from "@/lib/util/time";

// NOTE: /api/overview returns these fields at the top level (see
// src/app/api/overview/route.ts). Only /api/articles and /api/sources wrap
// their status fields in a `meta` object.
interface OverviewResponse {
  generatedAt: string;
  stale: boolean;
  fixtureMode: boolean;
  aiConfigured: boolean;
  errors: Array<{ sourceId: string; error: string }>;
  events: Event[];
  eventCount: number;
  articleCount: number;
  updates: Array<{ id: string; eventId: string; description: string; changeType: string; publishedAt: string | null; observedAt: string }>;
  sources: Array<{ id: string; name: string; lastStatus: string; lastRetrievedAt: string | null; itemCount: number }>;
  series: Array<{ hour: string; count: number }>;
  byRegion: Array<{ region: string; count: number; critical: number; notable: number }>;
}

export default function OverviewPage() {
  const { data, error, loading, refetch } = useApi<OverviewResponse>("/api/overview");
  const { prefs, hydrated } = usePreferences();
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const events = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.events].sort(compareByRelevance(hydrated ? prefs : null));
    return sorted;
  }, [data, prefs, hydrated]);

  const topEvents = events.slice(0, 8);
  const regional = data?.byRegion ?? [];
  const leadingRegion = [...regional].sort((a, b) => b.count - a.count)[0];

  const significantEvents = events.filter(
    (e) => e.significance.level === "critical" || e.significance.level === "notable",
  );

  const briefing = useMemo(() => {
    if (!data) return null;
    const parts: string[] = [];
    parts.push(
      `ORBIS is tracking ${data.eventCount} grouped event${data.eventCount === 1 ? "" : "s"} from ${data.articleCount} retrieved report${data.articleCount === 1 ? "" : "s"} across ${data.sources.filter((s) => s.lastStatus === "ok").length} active source${data.sources.filter((s) => s.lastStatus === "ok").length === 1 ? "" : "s"}.`,
    );
    if (significantEvents.length > 0) {
      parts.push(
        `${significantEvents.length} development${significantEvents.length === 1 ? " is" : "s are"} currently assessed as notable or critical.`,
      );
      const top = significantEvents[0];
      parts.push(
        `Most significant: “${top.title}” (${top.primaryGeo.name}, ${top.significance.level}, ${top.sourceIds.length} source${top.sourceIds.length === 1 ? "" : "s"}).`,
      );
    } else {
      parts.push("No development currently meets the notable or critical threshold.");
    }
    if (leadingRegion) {
      parts.push(
        `Highest event density: ${leadingRegion.region.replace(/-/g, " ")} (${leadingRegion.count} event${leadingRegion.count === 1 ? "" : "s"}).`,
      );
    }
    if (prefs.location) {
      const nearby = events.filter((e) => scoreEventForUser(e, prefs).nearUserLocation);
      parts.push(
        nearby.length > 0
          ? `${nearby.length} event${nearby.length === 1 ? "" : "s"} match your selected location ${prefs.location.name} at city level.`
          : `No events currently match your selected location ${prefs.location.name} at city level.`,
      );
    }
    parts.push(
      "This briefing summarises retrieved public reporting; it is not independent verification.",
    );
    return parts.join(" ");
  }, [data, significantEvents, leadingRegion, prefs, events]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Global Overview</h1>
          <p className="text-sm text-muted">Understand the world. See what matters.</p>
        </div>
        {data ? (
          <div className="flex items-center gap-1.5">
            <Badge tone={data.stale ? "amber" : "green"}>
              {data.stale ? "serving cached data" : "data current"} · {relativeTime(data.generatedAt)}
            </Badge>
            {data.errors.length > 0 ? (
              <Badge tone="amber" title={data.errors.map((e) => `${e.sourceId}: ${e.error}`).join("\n")}>
                {data.errors.length} source error{data.errors.length === 1 ? "" : "s"}
              </Badge>
            ) : (
              <Badge tone="green">all sources ok</Badge>
            )}
          </div>
        ) : null}
      </div>

      {loading ? <LoadingState label="Collecting public reporting…" /> : null}
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {data && briefing ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Global situation briefing</CardTitle>
              <span className="text-[11px] text-muted">auto-summary of ingested data</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-ink">{briefing}</p>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Significant developments</CardTitle>
                  <Link href="/news" className="text-xs text-accent hover:underline">
                    all reporting →
                  </Link>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topEvents.length === 0 ? (
                    <EmptyState
                      title="No events yet"
                      description="Ingested data produced no grouped events. Try refreshing the overview."
                      action={
                        <button onClick={refetch} className="rounded border border-line px-2 py-1 text-xs">
                          Refresh
                        </button>
                      }
                    />
                  ) : (
                    topEvents.map((e) => {
                      const rel = scoreEventForUser(e, hydrated ? prefs : null);
                      return (
                        <EventCard
                          key={e.id}
                          event={e}
                          onOpen={(ev) => setOpenEventId(ev.id)}
                          badge={
                            <>
                              {rel.nearUserLocation ? <Badge tone="dark">near {prefs.location?.name}</Badge> : null}
                              {rel.sameCountry && !rel.nearUserLocation ? <Badge tone="green">in your country</Badge> : null}
                            </>
                          }
                        />
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Reporting volume · 48h</CardTitle>
                </CardHeader>
                <CardContent>
                  <ArticlesOverTimeChart series={data.series} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Events by region</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.byRegion.length === 0 ? (
                    <EmptyState title="No regional data" />
                  ) : (
                    <EventsByRegionChart byRegion={data.byRegion} />
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Source freshness</CardTitle>
                  <Link href="/sources" className="text-xs text-accent hover:underline">
                    methodology →
                  </Link>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {data.sources.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-ink">{s.name}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-muted">{s.itemCount} items</span>
                        <Badge tone={s.lastStatus === "ok" ? "green" : s.lastStatus === "error" ? "red" : "neutral"}>
                          {s.lastRetrievedAt ? relativeTime(s.lastRetrievedAt) : s.lastStatus}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recently changed</CardTitle>
              <Link href="/what-changed" className="text-xs text-accent hover:underline">
                what changed →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.updates.length === 0 ? (
                <EmptyState title="No material changes recorded" description="Updates appear when new sources join an event or its status changes." />
              ) : (
                data.updates.slice(0, 6).map((u) => (
                  <div key={u.id} className="flex items-start gap-2 border-l-2 border-accent/40 pl-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="blue">{u.changeType.replace(/-/g, " ")}</Badge>
                        <span className="text-[11px] text-muted">
                          {relativeTime(u.publishedAt ?? u.observedAt)}
                        </span>
                      </div>
                      <button
                        className="mt-0.5 text-left text-sm text-ink hover:text-accent"
                        onClick={() => setOpenEventId(u.eventId)}
                      >
                        {u.description}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {openEventId ? (
        <EventDetailModal eventId={openEventId} onClose={() => setOpenEventId(null)} />
      ) : null}
    </div>
  );
}

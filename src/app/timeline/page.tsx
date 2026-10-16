"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Event } from "@/lib/types";
import { useApi } from "@/hooks/useApi";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { SignificanceBadge } from "@/components/domain/Badges";
import { relativeTime } from "@/lib/util/time";

interface TimelineResponse {
  event: Event;
  articles: Array<{
    id: string;
    title: string;
    sourceName: string;
    url: string;
    publishedAt: string;
    retrievedAt: string;
    eventTime: string | null;
  }>;
  updates: Array<{
    id: string;
    changeType: string;
    description: string;
    observedAt: string;
    publishedAt: string | null;
    eventTime: string | null;
  }>;
}

export default function TimelinePage() {
  const { data, error, loading, refetch } = useApi<{ events: Event[] }>("/api/events?limit=60");
  const [pickedId, setSelectedId] = useState<string | null>(null);
  // Derive the default selection instead of setting state in an effect.
  const selectedId = pickedId ?? data?.events[0]?.id ?? null;

  const detail = useApi<TimelineResponse>(
    selectedId ? `/api/events/${encodeURIComponent(selectedId)}` : "/api/health",
  );

  const timeline = useMemo(() => {
    if (!detail.data || "ok" in detail.data) return [];
    const rows: Array<{
      key: string;
      sortTime: string;
      kind: "report" | "change";
      title: string;
      sub: string;
      timeDetail: string;
      url?: string;
    }> = [];

    for (const a of detail.data.articles) {
      rows.push({
        key: `a-${a.id}`,
        sortTime: a.publishedAt,
        kind: "report",
        title: a.title,
        sub: `Report from ${a.sourceName}`,
        url: a.url,
        timeDetail: [
          a.eventTime ? `occurred ${relativeTime(a.eventTime)}` : "occurrence time not established",
          `published ${relativeTime(a.publishedAt)}`,
          `retrieved ${relativeTime(a.retrievedAt)}`,
        ].join(" · "),
      });
    }
    for (const u of detail.data.updates) {
      rows.push({
        key: `u-${u.id}`,
        sortTime: u.publishedAt ?? u.observedAt,
        kind: "change",
        title: u.description,
        sub: `Recorded change: ${u.changeType.replace(/-/g, " ")}`,
        timeDetail: [
          u.eventTime ? `occurred ${relativeTime(u.eventTime)}` : null,
          u.publishedAt ? `published ${relativeTime(u.publishedAt)}` : null,
          `observed by ORBIS ${relativeTime(u.observedAt)}`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
    return rows.sort((a, b) => b.sortTime.localeCompare(a.sortTime));
  }, [detail.data]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Situation Timeline</h1>
        <p className="text-sm text-muted">
          Chronology built strictly from retrieved reports and observed changes. Missing history is
          not invented.
        </p>
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {data ? (
        <div className="grid gap-5 lg:grid-cols-4">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <Badge tone="neutral">{data.events.length}</Badge>
            </CardHeader>
            <CardContent className="max-h-[560px] space-y-1 overflow-y-auto">
              {data.events.length === 0 ? (
                <EmptyState title="No events ingested yet" />
              ) : (
                data.events.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full rounded border px-2 py-1.5 text-left text-xs ${
                      selectedId === e.id
                        ? "border-accent bg-emerald-50"
                        : "border-line hover:bg-surface-2"
                    }`}
                    aria-pressed={selectedId === e.id}
                  >
                    <span className="block font-medium text-ink">{e.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                      <SignificanceBadge level={e.significance.level} />
                      {e.primaryGeo.name}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-3">
            {detail.loading ? <LoadingState label="Loading timeline…" /> : null}
            {detail.error && selectedId ? (
              <ErrorState error={detail.error} onRetry={detail.refetch} />
            ) : null}
            {detail.data && !("ok" in detail.data) ? (
              <Card>
                <CardHeader>
                  <CardTitle>{detail.data.event.title}</CardTitle>
                  <span className="text-[11px] text-muted">
                    {detail.data.event.sourceIds.length} source
                    {detail.data.event.sourceIds.length === 1 ? "" : "s"} · status{" "}
                    {detail.data.event.status}
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 rounded border border-line bg-surface-2/60 px-2.5 py-2 text-[11px] text-muted">
                    <strong className="text-ink">Time legend:</strong> development time = when it
                    happened (often unknown) · publication = when a source reported it · retrieval =
                    when ORBIS fetched it · observed = when ORBIS recorded a change.
                  </p>
                  {timeline.length === 0 ? (
                    <EmptyState title="No timeline entries" />
                  ) : (
                    <ol className="relative space-y-3 border-l border-line pl-4">
                      {timeline.map((row) => (
                        <li key={row.key} className="relative">
                          <span
                            className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${
                              row.kind === "report" ? "bg-forest" : "bg-accent"
                            }`}
                            aria-hidden="true"
                          />
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={row.kind === "report" ? "neutral" : "green"}>
                              {row.kind === "report" ? "report" : "change"}
                            </Badge>
                            <span className="text-[11px] text-muted">{row.sub}</span>
                          </div>
                          <div className="mt-0.5 text-sm text-ink">
                            {row.url ? (
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-start gap-1 hover:text-accent"
                              >
                                {row.title}
                                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                              </a>
                            ) : (
                              row.title
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted">{row.timeDetail}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

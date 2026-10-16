"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { Article } from "@/lib/types";
import { REGIONS, SIGNIFICANCE_LEVELS, TOPICS } from "@/lib/types";
import { useApi, useDebouncedValue } from "@/hooks/useApi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { SignificanceBadge } from "@/components/domain/Badges";
import { SaveButton } from "@/components/domain/SaveButton";
import { EventDetailModal } from "@/components/domain/EventDetailModal";
import { relativeTime } from "@/lib/util/time";

interface ArticleRow extends Article {
  eventTitle: string | null;
  eventLevel: "critical" | "notable" | "routine" | null;
  freshness: string;
}

const PAGE_SIZE = 30;

const FRESHNESS_TONE: Record<string, "green" | "amber" | "neutral"> = {
  fresh: "green",
  recent: "green",
  aging: "amber",
  stale: "neutral",
};

export function NewsClient() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [topic, setTopic] = useState(searchParams.get("topic") ?? "");
  const [region, setRegion] = useState(searchParams.get("region") ?? "");
  const [level, setLevel] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [hours, setHours] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const debouncedQ = useDebouncedValue(q, 350);

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: String(limit) });
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (topic) p.set("topic", topic);
    if (region) p.set("region", region);
    if (level) p.set("level", level);
    if (sourceId) p.set("sourceId", sourceId);
    if (hours) p.set("hours", hours);
    return p.toString();
  }, [debouncedQ, topic, region, level, sourceId, hours, limit]);

  const { data, error, loading, refetch } = useApi<{
    articles: ArticleRow[];
    total: number;
    meta: { generatedAt: string; stale: boolean; fixtureMode: boolean };
  }>(`/api/articles?${params}`);

  const sources = useApi<{ sources: Array<{ id: string; name: string }> }>("/api/sources");

  const hasFilters = Boolean(q || topic || region || level || sourceId || hours);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Live News</h1>
          <p className="text-sm text-muted">
            Retrieved from public feeds on a schedule — not a real-time stream. Each item shows its
            publication and retrieval time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data ? (
            <Badge tone={data.meta.stale ? "amber" : "green"}>
              snapshot {relativeTime(data.meta.generatedAt)}
            </Badge>
          ) : null}
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <Label htmlFor="news-q">Search</Label>
            <Input
              id="news-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Keyword, country, source…"
            />
          </div>
          <div>
            <Label htmlFor="news-topic">Topic</Label>
            <Select id="news-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">All</option>
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/-/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="news-region">Region</Label>
            <Select id="news-region" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">All</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/-/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="news-significance">Significance</Label>
            <Select id="news-significance" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All</option>
              {SIGNIFICANCE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="news-source">Source</Label>
            <Select id="news-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">All</option>
              {(sources.data?.sources ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="news-hours">Retrieved within</Label>
            <Select id="news-hours" value={hours} onChange={(e) => setHours(e.target.value)}>
              <option value="">Any time</option>
              <option value="24">Last 24 hours</option>
              <option value="72">Last 3 days</option>
              <option value="168">Last 7 days</option>
            </Select>
          </div>
          {hasFilters ? (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setTopic("");
                  setRegion("");
                  setLevel("");
                  setSourceId("");
                  setHours("");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {loading ? <LoadingState label="Loading reports…" /> : null}
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {data ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              {data.total} matching report{data.total === 1 ? "" : "s"}
            </p>
          </div>
          {data.articles.length === 0 ? (
            <EmptyState
              title="No reports match these filters"
              description={
                hasFilters
                  ? "Try widening the time window or clearing filters."
                  : "No data has been ingested yet. The first refresh happens automatically when data is requested."
              }
              action={
                <Button variant="outline" size="sm" onClick={refetch}>
                  Retry
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {data.articles.map((a) => (
                <article key={a.id} className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-1.5 text-sm font-semibold leading-snug text-ink hover:text-accent"
                      >
                        {a.title}
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                      </a>
                      {a.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{a.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {a.eventLevel ? <SignificanceBadge level={a.eventLevel} /> : null}
                      <SaveButton
                        item={{
                          id: a.id,
                          kind: "article",
                          title: a.title,
                          url: a.url,
                          snippet: a.description,
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <Badge tone="neutral">{a.sourceName}</Badge>
                    <span>published {relativeTime(a.publishedAt)}</span>
                    <span>· retrieved {relativeTime(a.retrievedAt)}</span>
                    <Badge tone={FRESHNESS_TONE[a.freshness] ?? "neutral"}>{a.freshness}</Badge>
                    {a.topics.slice(0, 2).map((t) => (
                      <Badge key={t} tone="green">
                        {t.replace(/-/g, " ")}
                      </Badge>
                    ))}
                    {a.geo.slice(0, 2).map((g) => (
                      <Badge key={g.name} tone="neutral">
                        {g.name}
                      </Badge>
                    ))}
                    {a.eventId ? (
                      <button
                        onClick={() => setOpenEventId(a.eventId)}
                        className="text-accent hover:underline"
                      >
                        grouped event: {a.eventTitle?.slice(0, 60) ?? "open"} →
                      </button>
                    ) : (
                      <span className="italic">not grouped into an event</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {data.articles.length < data.total ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Load more ({data.total - data.articles.length} remaining)
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {openEventId ? (
        <EventDetailModal eventId={openEventId} onClose={() => setOpenEventId(null)} />
      ) : null}
    </div>
  );
}

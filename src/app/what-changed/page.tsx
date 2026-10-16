"use client";

import { useMemo, useState } from "react";
import type { Event } from "@/lib/types";
import { useApi } from "@/hooks/useApi";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { SignificanceBadge } from "@/components/domain/Badges";
import { EventDetailModal } from "@/components/domain/EventDetailModal";
import { relativeTime } from "@/lib/util/time";

interface UpdateRow {
  id: string;
  eventId: string;
  description: string;
  changeType: string;
  publishedAt: string | null;
  observedAt: string;
}

const MATERIAL_TYPES = [
  "official-statement",
  "status-change",
  "correction",
  "new-location",
  "warning-issued",
  "warning-withdrawn",
] as const;

export default function WhatChangedPage() {
  const { data, error, loading, refetch } = useApi<{
    events: Event[];
    updates: UpdateRow[];
  }>("/api/overview");
  const [types, setTypes] = useState<string[]>([...MATERIAL_TYPES]);
  const [includeNewSources, setIncludeNewSources] = useState(true);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const eventsById = useMemo(
    () => new Map((data?.events ?? []).map((e) => [e.id, e])),
    [data],
  );

  const rows = useMemo(() => {
    if (!data) return [];
    const allowed = new Set(types);
    if (includeNewSources) {
      allowed.add("new-source");
      allowed.add("new-information");
    }
    return data.updates.filter((u) => allowed.has(u.changeType));
  }, [data, types, includeNewSources]);

  function toggleType(t: string) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">What Changed</h1>
        <p className="text-sm text-muted">
          Material developments only — new official statements, corrections, newly located events
          and status changes. Trivial headline edits and duplicate articles are filtered out.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change types</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {MATERIAL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              aria-pressed={types.includes(t)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                types.includes(t)
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-muted hover:bg-surface-2"
              }`}
            >
              {t.replace(/-/g, " ")}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={includeNewSources}
              onChange={(e) => setIncludeNewSources(e.target.checked)}
            />
            include new independent reporting
          </label>
        </CardContent>
      </Card>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {data ? (
        rows.length === 0 ? (
          <EmptyState
            title="No changes match the selected types"
            description="Either no material change has been observed in the retained data, or the current filter excludes it."
          />
        ) : (
          <div className="space-y-2">
            {rows.map((u) => {
              const event = eventsById.get(u.eventId);
              return (
                <Card key={u.id}>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="blue">{u.changeType.replace(/-/g, " ")}</Badge>
                      {event ? <SignificanceBadge level={event.significance.level} /> : null}
                      <span className="text-[11px] text-muted">
                        observed by ORBIS {relativeTime(u.observedAt)}
                        {u.publishedAt ? ` · source published ${relativeTime(u.publishedAt)}` : ""}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-ink">{u.description}</p>
                    {event ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                        <button
                          onClick={() => setOpenEventId(event.id)}
                          className="text-accent hover:underline"
                        >
                          {event.title}
                        </button>
                        <span>·</span>
                        <span>
                          {event.sourceIds.length} source{event.sourceIds.length === 1 ? "" : "s"}:{" "}
                          {event.sourceNames.slice(0, 3).join(", ")}
                        </span>
                        <span>·</span>
                        <span>{event.primaryGeo.name}</span>
                      </div>
                    ) : null}
                    {event ? (
                      <p className="mt-1 text-[11px] text-muted">
                        Why it matters:{" "}
                        {event.significance.level === "critical"
                          ? "high-significance event (recency, source corroboration, scope and category weight)."
                          : event.significance.level === "notable"
                            ? "notable event under ORBIS criteria."
                            : "routine event; recorded for completeness."}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {openEventId ? (
        <EventDetailModal eventId={openEventId} onClose={() => setOpenEventId(null)} />
      ) : null}
    </div>
  );
}

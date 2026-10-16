"use client";

import { MapPin, Clock } from "lucide-react";
import type { Event } from "@/lib/types";
import { EvidenceBadge, SignificanceBadge } from "@/components/domain/Badges";
import { SaveButton } from "@/components/domain/SaveButton";
import { relativeTime } from "@/lib/util/time";

const PRECISION_NOTE: Record<string, string | null> = {
  exact: null,
  city: "city-level",
  admin: "province-level",
  country: "country-level (approximate area)",
  region: "regional (approximate area)",
  uncertain: "location uncertain",
};

export function EventCard({
  event,
  onOpen,
  badge,
}: {
  event: Event;
  onOpen?: (event: Event) => void;
  badge?: React.ReactNode;
}) {
  const precision = PRECISION_NOTE[event.primaryGeo.kind];

  return (
    <div className="rounded-lg border border-line bg-surface p-3 transition-colors hover:border-accent/50">
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => onOpen?.(event)}
          className="min-w-0 text-left"
          aria-label={`Open details for ${event.title}`}
        >
          <h3 className="text-sm font-semibold leading-snug text-ink hover:text-accent">
            {event.title}
          </h3>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <SignificanceBadge level={event.significance.level} />
          <SaveButton
            item={{
              id: event.id,
              kind: "event",
              title: event.title,
              url: null,
              snippet: event.summary,
            }}
          />
        </div>
      </div>

      <p className="mt-1 text-xs text-muted">{event.summary}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {badge}
        {event.evidenceLabels.slice(0, 3).map((l) => (
          <EvidenceBadge key={l} label={l} />
        ))}
        {event.categories.slice(0, 2).map((c) => (
          <span key={c} className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">
            {c.replace(/-/g, " ")}
          </span>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {event.primaryGeo.name}
          {precision ? <span className="italic"> · {precision}</span> : null}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          updated {relativeTime(event.lastUpdatedAt)}
        </span>
        <span>
          {event.sourceIds.length} source{event.sourceIds.length === 1 ? "" : "s"}:{" "}
          {event.sourceNames.slice(0, 3).join(", ")}
        </span>
      </div>
    </div>
  );
}

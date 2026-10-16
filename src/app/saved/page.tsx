"use client";

import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { EventDetailModal } from "@/components/domain/EventDetailModal";
import { relativeTime } from "@/lib/util/time";

export default function SavedPage() {
  const { saved, toggleSaved, hydrated } = usePreferences();
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Saved Items</h1>
        <p className="text-sm text-muted">
          Saved events and reports are stored in this browser only (localStorage) — they are not
          synced to a server or across devices.
        </p>
      </div>

      {!hydrated ? (
        <Card>
          <CardContent>Loading…</CardContent>
        </Card>
      ) : saved.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Use the Save button on any event or report to keep it here for later."
        />
      ) : (
        <div className="space-y-2">
          {saved.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={s.kind === "event" ? "green" : "neutral"}>{s.kind}</Badge>
                    <span className="text-[11px] text-muted">saved {relativeTime(s.savedAt)}</span>
                  </div>
                  {s.kind === "article" && s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-start gap-1 text-sm font-medium text-ink hover:text-accent"
                    >
                      {s.title}
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                    </a>
                  ) : (
                    <button
                      className="mt-1 block text-left text-sm font-medium text-ink hover:text-accent"
                      onClick={() => setOpenEventId(s.id)}
                    >
                      {s.title}
                    </button>
                  )}
                  {s.snippet ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{s.snippet}</p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toggleSaved({ id: s.id, kind: s.kind, title: s.title, url: s.url, snippet: s.snippet })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {openEventId ? (
        <EventDetailModal eventId={openEventId} onClose={() => setOpenEventId(null)} />
      ) : null}
    </div>
  );
}

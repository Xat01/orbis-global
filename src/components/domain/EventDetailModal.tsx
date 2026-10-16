"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import type { Article, Briefing, BriefingMode, Event, EventUpdate } from "@/lib/types";
import { useApi } from "@/hooks/useApi";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { EvidenceBadge, SignificanceBadge } from "@/components/domain/Badges";
import { relativeTime } from "@/lib/util/time";

interface EventDetailResponse {
  event: Event;
  articles: Article[];
  updates: EventUpdate[];
  briefing: Briefing;
  aiStatus: "ok" | "not-configured" | "failed";
  aiError?: string;
}

const MODE_LABELS: Record<BriefingMode, string> = {
  quick: "Quick Brief",
  standard: "Standard Brief",
  detailed: "Detailed Brief",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      <div className="mt-1.5 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

function Bullets({ items, tone }: { items: string[]; tone?: "green" | "amber" }) {
  if (items.length === 0) return <p className="text-xs italic text-muted">None identified.</p>;
  return (
    <ul className="space-y-1">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className={tone === "green" ? "text-accent" : tone === "amber" ? "text-warning" : "text-muted"}>
            ▸
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function EventDetailModal({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const { prefs } = usePreferences();
  const [mode, setMode] = useState<BriefingMode>(prefs.briefingMode ?? "standard");
  const [tab, setTab] = useState<"briefing" | "timeline" | "sources">("briefing");
  const { data, error, loading, refetch } = useApi<EventDetailResponse>(
    `/api/events/${encodeURIComponent(eventId)}?mode=${mode}`,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const b = data?.briefing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10"
      role="dialog"
      aria-modal="true"
      aria-label="Event details"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-lg bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 rounded-t-lg border-b border-line bg-surface px-4 py-3">
          <div>
            <h2 className="text-base font-bold leading-snug text-ink">
              {data?.event.title ?? "Event"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {data ? <SignificanceBadge level={data.event.significance.level} /> : null}
              {data?.event.evidenceLabels.map((l) => <EvidenceBadge key={l} label={l} />)}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? <LoadingState label="Loading briefing…" /> : null}
        {error ? <ErrorState error={error} onRetry={refetch} /> : null}

        {data && b ? (
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-line p-0.5" role="tablist" aria-label="Briefing length">
                {(Object.keys(MODE_LABELS) as BriefingMode[]).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${
                      mode === m ? "bg-forest text-white" : "text-muted hover:bg-surface-2"
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
              <Badge tone={b.generator === "ai" ? "blue" : "neutral"}>
                {b.generator === "ai" ? "AI-generated summary" : "Basic summary (no AI configured)"}
              </Badge>
              {data.aiStatus === "failed" ? (
                <Badge tone="amber" title={data.aiError}>AI failed — using basic summary</Badge>
              ) : null}
            </div>

            <div className="mt-3 flex gap-1 border-b border-line">
              {(["briefing", "timeline", "sources"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`border-b-2 px-3 py-1.5 text-xs font-medium capitalize ${
                    tab === t ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "briefing" ? (
              <div className="pb-4">
                <Section title="What happened?">{b.whatHappened}</Section>
                <Section title="Where and when?">{b.whereWhen}</Section>
                {mode !== "quick" ? (
                  <Section title="Who is involved?">{b.whoIsInvolved}</Section>
                ) : null}
                <Section title="What is confirmed?">
                  <Bullets items={mode === "quick" ? b.confirmed.slice(0, 3) : b.confirmed} tone="green" />
                </Section>
                <Section title="What remains uncertain?">
                  <Bullets items={mode === "quick" ? b.uncertain.slice(0, 2) : b.uncertain} tone="amber" />
                </Section>
                <Section title="Why does it matter?">{b.whyItMatters}</Section>
                <Section title="What could happen next?">
                  {b.analysisLabel ? (
                    <p className="mb-1 text-[11px] italic text-warning">{b.analysisLabel}</p>
                  ) : null}
                  <Bullets items={b.whatCouldHappenNext} />
                </Section>
                <Section title="Who or what could be affected?">{b.affected}</Section>
                <Section title="What should be watched next?">
                  <Bullets items={b.watchNext} />
                </Section>
                <Section title="Limitations">
                  <Bullets items={b.limitations} />
                </Section>
              </div>
            ) : null}

            {tab === "timeline" ? (
              <div className="space-y-2 py-3">
                {data.updates.length === 0 ? (
                  <p className="text-sm text-muted">No material updates recorded yet.</p>
                ) : (
                  data.updates.map((u) => (
                    <div key={u.id} className="rounded border border-line bg-surface-2/50 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="blue">{u.changeType.replace(/-/g, " ")}</Badge>
                        <span className="text-[11px] text-muted">
                          published {u.publishedAt ? relativeTime(u.publishedAt) : "unknown"} · observed{" "}
                          {relativeTime(u.observedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{u.description}</p>
                    </div>
                  ))
                )}
                <p className="pt-1 text-[11px] text-muted">
                  Times distinguish when a development occurred (if known), when sources published,
                  and when ORBIS observed the change. Missing history is not invented.
                </p>
              </div>
            ) : null}

            {tab === "sources" ? (
              <div className="space-y-2 py-3">
                {data.articles.map((a) => (
                  <div key={a.id} className="rounded border border-line p-2.5">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-1.5 text-sm font-medium text-ink hover:text-accent"
                    >
                      {a.title}
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      <Badge tone="neutral">{a.sourceName}</Badge>
                      <span>published {relativeTime(a.publishedAt)}</span>
                      <span>· retrieved {relativeTime(a.retrievedAt)}</span>
                      {a.eventTime ? <span>· occurred {relativeTime(a.eventTime)}</span> : null}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted">
                  Headlines and short summaries only; ORBIS links to original reporting rather than
                  republishing full articles.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {data ? (
          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

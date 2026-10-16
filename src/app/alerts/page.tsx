"use client";

import { useMemo, useState } from "react";
import type { Event, EventUpdate, Region, SignificanceLevel, Topic } from "@/lib/types";
import { REGIONS, SIGNIFICANCE_LEVELS, TOPICS } from "@/lib/types";
import { useApi } from "@/hooks/useApi";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { buildAlerts } from "@/lib/intelligence/alerts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { EventDetailModal } from "@/components/domain/EventDetailModal";
import { relativeTime } from "@/lib/util/time";

export default function AlertsPage() {
  const { prefs, setAlertPrefs, readAlerts, dismissedAlerts, markAlertRead, markAllAlertsRead, dismissAlert, hydrated } =
    usePreferences();
  const { data, error, loading, refetch } = useApi<{ events: Event[]; updates: EventUpdate[] }>(
    "/api/overview",
  );
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const alerts = useMemo(() => {
    if (!data) return [];
    return buildAlerts(data.events, data.updates, prefs);
  }, [data, prefs]);

  const visible = useMemo(
    () =>
      alerts.filter(
        (a) => !dismissedAlerts.has(a.id) && (!unreadOnly || !readAlerts.has(a.id)),
      ),
    [alerts, dismissedAlerts, readAlerts, unreadOnly],
  );

  const unreadCount = alerts.filter(
    (a) => !dismissedAlerts.has(a.id) && !readAlerts.has(a.id),
  ).length;

  function toggleRegion(r: Region) {
    const regions = prefs.alerts.regions.includes(r)
      ? prefs.alerts.regions.filter((x) => x !== r)
      : [...prefs.alerts.regions, r];
    setAlertPrefs({ ...prefs.alerts, regions });
  }

  function toggleTopic(t: Topic) {
    const topics = prefs.alerts.topics.includes(t)
      ? prefs.alerts.topics.filter((x) => x !== t)
      : [...prefs.alerts.topics, t];
    setAlertPrefs({ ...prefs.alerts, topics });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Alerts</h1>
          <p className="text-sm text-muted">
            In-app alerts only. ORBIS does not send email, SMS or push notifications — that
            infrastructure is not implemented.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={unreadCount > 0 ? "amber" : "green"}>
            {unreadCount} unread
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAlertsRead(visible.map((a) => a.id))}
            disabled={visible.length === 0}
          >
            Mark all read
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alert preferences</CardTitle>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={prefs.alerts.enabled}
              onChange={(e) => setAlertPrefs({ ...prefs.alerts, enabled: e.target.checked })}
            />
            alerts enabled
          </label>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Minimum significance</Label>
            <Select
              value={prefs.alerts.minSignificance}
              onChange={(e) =>
                setAlertPrefs({
                  ...prefs.alerts,
                  minSignificance: e.target.value as SignificanceLevel,
                })
              }
              className="max-w-xs"
            >
              {SIGNIFICANCE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Regions (none selected = all regions)</Label>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.filter((r) => r !== "global").map((r) => (
                <button
                  key={r}
                  onClick={() => toggleRegion(r)}
                  aria-pressed={prefs.alerts.regions.includes(r)}
                  className={`rounded border px-2 py-0.5 text-[11px] ${
                    prefs.alerts.regions.includes(r)
                      ? "border-forest bg-forest text-white"
                      : "border-line text-muted hover:bg-surface-2"
                  }`}
                >
                  {r.replace(/-/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Topics (none selected = all topics)</Label>
            <div className="flex flex-wrap gap-1.5">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTopic(t)}
                  aria-pressed={prefs.alerts.topics.includes(t)}
                  className={`rounded border px-2 py-0.5 text-[11px] ${
                    prefs.alerts.topics.includes(t)
                      ? "border-accent bg-accent text-white"
                      : "border-line text-muted hover:bg-surface-2"
                  }`}
                >
                  {t.replace(/-/g, " ")}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {data ? (
        <>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />
              unread only
            </label>
            <span className="text-xs text-muted">
              {alerts.length} total · {visible.length} shown
            </span>
          </div>

          {!prefs.alerts.enabled ? (
            <EmptyState
              title="Alerts are disabled"
              description="Enable alerts above to generate in-app alerts from events matching your preferences."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAlertPrefs({ ...prefs.alerts, enabled: true })}
                >
                  Enable alerts
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              title={hydrated ? "No alerts match your preferences" : "Loading preferences…"}
              description={
                prefs.alerts.regions.length || prefs.alerts.topics.length
                  ? "No current event meets the selected regions/topics and minimum significance."
                  : "Alerts appear here when events meet the minimum significance threshold."
              }
            />
          ) : (
            <div className="space-y-2">
              {visible.map((a) => {
                const unread = !readAlerts.has(a.id);
                return (
                  <Card key={a.id} className={unread ? "border-l-2 border-l-accent" : ""}>
                    <CardContent className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {unread ? <Badge tone="dark">new</Badge> : <Badge tone="neutral">read</Badge>}
                          <Badge tone={a.level === "critical" ? "red" : "amber"}>{a.level}</Badge>
                          {a.changeType ? <Badge tone="blue">{a.changeType.replace(/-/g, " ")}</Badge> : null}
                          <span className="text-[11px] text-muted">{relativeTime(a.createdAt)}</span>
                        </div>
                        <button
                          className="mt-1 block text-left text-sm font-medium text-ink hover:text-accent"
                          onClick={() => {
                            markAlertRead(a.id);
                            setOpenEventId(a.eventId);
                          }}
                        >
                          {a.title}
                        </button>
                        <p className="mt-0.5 text-xs text-muted">{a.text}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAlertRead(a.id)}
                          disabled={!unread}
                        >
                          Mark read
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => dismissAlert(a.id)}>
                          Dismiss
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {openEventId ? (
        <EventDetailModal eventId={openEventId} onClose={() => setOpenEventId(null)} />
      ) : null}
    </div>
  );
}

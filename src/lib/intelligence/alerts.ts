import type { Event, EventUpdate, SignificanceLevel, UserPreferences } from "@/lib/types";
import { relativeTime } from "@/lib/util/time";

// ---------------------------------------------------------------------------
// In-app alert generation (client-side, from preferences stored locally).
//
// Alerts are generated deterministically from grouped events and observed
// changes. Stable IDs make them dedupe-able: dismissing or reading an alert
// affects that alert only. No email/SMS/push exists — this is in-app only.
// ---------------------------------------------------------------------------

export interface Alert {
  id: string;
  eventId: string;
  title: string;
  text: string;
  level: SignificanceLevel;
  changeType?: string;
  createdAt: string;
}

const LEVEL_ORDER: Record<SignificanceLevel, number> = { routine: 1, notable: 2, critical: 3 };

const ALERTING_CHANGES = new Set([
  "official-statement",
  "correction",
  "status-change",
  "warning-issued",
  "warning-withdrawn",
  "new-location",
]);

export function buildAlerts(
  events: Event[],
  updates: EventUpdate[],
  prefs: UserPreferences | null | undefined,
  now: number = Date.now(),
): Alert[] {
  if (!prefs?.alerts?.enabled) return [];

  const minLevel = LEVEL_ORDER[prefs.alerts.minSignificance] ?? 2;
  const wantedRegions = new Set(prefs.alerts.regions);
  const wantedTopics = new Set(prefs.alerts.topics);

  const matches = (event: Event): boolean => {
    if (LEVEL_ORDER[event.significance.level] < minLevel) return false;
    const region = event.primaryGeo.region ?? "global";
    if (wantedRegions.size > 0 && !wantedRegions.has(region)) return false;
    if (wantedTopics.size > 0 && !event.categories.some((c) => wantedTopics.has(c))) return false;
    return true;
  };

  const byId = new Map<string, Event>();
  for (const e of events) byId.set(e.id, e);

  const alerts: Alert[] = [];

  // Change-based alerts (the meaningful ones).
  for (const u of updates) {
    const event = byId.get(u.eventId);
    if (!event || !matches(event) || !ALERTING_CHANGES.has(u.changeType)) continue;
    alerts.push({
      id: `alert_upd_${u.id}`,
      eventId: event.id,
      title: event.title,
      text: `${u.changeType.replace(/-/g, " ")} — ${u.description}`,
      level: event.significance.level,
      changeType: u.changeType,
      createdAt: u.publishedAt ?? u.observedAt,
    });
  }

  // Significance alerts for events that meet the threshold but have no
  // qualifying change recorded (so nothing is missed silently).
  const eventIdsWithChangeAlerts = new Set(alerts.map((a) => a.eventId));
  for (const event of events) {
    if (!matches(event) || eventIdsWithChangeAlerts.has(event.id)) continue;
    if (event.significance.level !== "critical") continue; // only critical events page you
    alerts.push({
      id: `alert_evt_${event.id}`,
      eventId: event.id,
      title: event.title,
      text: `New critical-significance event: ${event.summary} Location: ${event.primaryGeo.name}.`,
      level: event.significance.level,
      createdAt: event.lastUpdatedAt,
    });
  }

  // Dedupe by ID, newest first.
  const deduped = [...new Map(alerts.map((a) => [a.id, a])).values()];
  deduped.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  void now;
  return deduped;
}

/** Human summary of why an alert fired (shown in the UI). */
export function alertReason(alert: Alert): string {
  const when = relativeTime(alert.createdAt);
  if (alert.changeType === "official-statement") return `Official statement published ${when}.`;
  if (alert.changeType === "correction") return `A source issued a correction ${when}.`;
  if (alert.changeType === "new-location") return `New affected location reported ${when}.`;
  if (alert.changeType) return `${alert.changeType.replace(/-/g, " ")} ${when}.`;
  return `Critical-significance event detected ${when}.`;
}

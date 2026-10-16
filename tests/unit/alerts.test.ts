import { describe, expect, it } from "vitest";
import type { EventUpdate, UserPreferences } from "@/lib/types";
import { buildAlerts } from "@/lib/intelligence/alerts";
import { loadFixtureSnapshot } from "@/lib/sources/fixtures";

const snap = loadFixtureSnapshot();
const event = snap.events[0];

function update(changeType: EventUpdate["changeType"], id = "upd_1"): EventUpdate {
  return {
    id,
    eventId: event.id,
    observedAt: "2026-10-16T12:00:00.000Z",
    eventTime: null,
    publishedAt: "2026-10-16T12:00:00.000Z",
    changeType,
    description: "Something changed.",
    articleIds: [],
    previousStatus: null,
    currentStatus: null,
  };
}

function prefs(overrides: Partial<UserPreferences["alerts"]> = {}): UserPreferences {
  return {
    location: null,
    topics: [],
    regions: [],
    briefingMode: "standard",
    alerts: {
      regions: [],
      topics: [],
      minSignificance: "routine",
      enabled: true,
      ...overrides,
    },
  };
}

describe("buildAlerts", () => {
  it("returns nothing when alerts are disabled or preferences are absent", () => {
    expect(buildAlerts([event], [update("official-statement")], null)).toEqual([]);
    expect(buildAlerts([event], [update("official-statement")], prefs({ enabled: false }))).toEqual([]);
  });

  it("creates an alert for an alerting change and ignores non-alerting changes", () => {
    const alerts = buildAlerts(
      [event],
      [update("official-statement", "a"), update("new-information", "b")],
      prefs(),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].eventId).toBe(event.id);
    expect(alerts[0].changeType).toBe("official-statement");
  });

  it("produces stable IDs so an alert can be dismissed by id", () => {
    const first = buildAlerts([event], [update("correction")], prefs());
    const second = buildAlerts([event], [update("correction")], prefs());
    expect(first[0].id).toBe(second[0].id);
  });

  it("honours the minimum significance threshold", () => {
    const routine = snap.events.find((e) => e.significance.level === "routine");
    const critical = snap.events.find((e) => e.significance.level === "critical");
    expect(routine).toBeDefined();
    if (!routine || !critical) return;
    const upd = (e: typeof event): EventUpdate => ({ ...update("official-statement"), eventId: e.id });
    const alerts = buildAlerts([routine, critical], [upd(routine), upd(critical)], prefs({ minSignificance: "critical" }));
    expect(alerts.every((a) => a.level === "critical")).toBe(true);
  });

  it("filters out events outside the wanted regions", () => {
    const region = event.primaryGeo.region ?? "global";
    const otherRegion = region === "europe" ? "africa" : "europe";
    const inRegion = buildAlerts([event], [update("official-statement")], prefs({ regions: [region] }));
    const outOfRegion = buildAlerts([event], [update("official-statement")], prefs({ regions: [otherRegion] }));
    expect(inRegion).toHaveLength(1);
    expect(outOfRegion).toHaveLength(0);
  });
});

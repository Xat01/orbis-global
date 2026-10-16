import { describe, expect, it } from "vitest";
import type { Region, UserPreferences } from "@/lib/types";
import { compareByRelevance, scoreEventForUser } from "@/lib/personalization/relevance";
import { loadFixtureSnapshot } from "@/lib/sources/fixtures";

const snap = loadFixtureSnapshot();
const placer = snap.events.find((e) => e.geo.length > 0)!;
const geo = placer.geo[0];

function prefs(partial: Partial<UserPreferences> = {}): UserPreferences {
  return {
    location: null,
    topics: [],
    regions: [],
    briefingMode: "standard",
    alerts: { regions: [], topics: [], minSignificance: "notable", enabled: true },
    ...partial,
  };
}

describe("scoreEventForUser", () => {
  it("uses intrinsic significance with no personalization data", () => {
    const r = scoreEventForUser(placer, null);
    expect(r.score).toBeCloseTo(placer.significance.score / 10, 5);
    expect(r.nearUserLocation).toBe(false);
    expect(r.sameCountry).toBe(false);
    expect(r.topicMatch).toBe(false);
  });

  it("flags a city-level match only when the event geometry contains the location name", () => {
    const r = scoreEventForUser(
      placer,
      prefs({
        location: {
          name: geo.name,
          country: geo.country ?? "",
          region: (placer.primaryGeo.region ?? "global") as Region,
          lat: geo.lat ?? 0,
          lng: geo.lng ?? 0,
          precision: "city",
        },
      }),
    );
    expect(r.nearUserLocation).toBe(true);
    expect(r.score).toBeGreaterThan(placer.significance.score / 10);
  });

  it("flags a same-country match for a country-level preference", () => {
    if (!geo.country) return;
    const r = scoreEventForUser(
      placer,
      prefs({
        location: {
          name: "Some Other City",
          country: geo.country,
          region: (placer.primaryGeo.region ?? "global") as Region,
          lat: 0,
          lng: 0,
          precision: "country",
        },
      }),
    );
    expect(r.sameCountry).toBe(true);
    expect(r.nearUserLocation).toBe(false);
  });

  it("flags a topic match against selected topics", () => {
    const topic = placer.categories[0];
    if (!topic) return;
    const r = scoreEventForUser(placer, prefs({ topics: [topic] }));
    expect(r.topicMatch).toBe(true);
  });
});

describe("compareByRelevance", () => {
  it("orders events by descending personalized score", () => {
    const p = prefs({
      location: {
        name: geo.name,
        country: geo.country ?? "",
        region: (placer.primaryGeo.region ?? "global") as Region,
        lat: geo.lat ?? 0,
        lng: geo.lng ?? 0,
        precision: "city",
      },
    });
    const cmp = compareByRelevance(p);
    const sorted = [...snap.events].sort(cmp).map((e) => e.id);
    const expected = [...snap.events]
      .sort((a, b) => scoreEventForUser(b, p).score - scoreEventForUser(a, p).score)
      .map((e) => e.id);
    expect(sorted).toEqual(expected);
  });
});

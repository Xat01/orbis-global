import { describe, expect, it } from "vitest";
import {
  categoryWeight,
  geoScopePoints,
  levelForScore,
  recencyPoints,
  scoreEvent,
  sourceCountPoints,
} from "@/lib/ingest/significance";
import { resolveGeoFromText, nearestPlace, distanceKm, countryToRegion } from "@/lib/geo/gazetteer";

describe("significance scoring", () => {
  it("awards more recency points to fresher events", () => {
    const now = new Date();
    const iso = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
    expect(recencyPoints(iso(1))).toBe(3);
    expect(recencyPoints(iso(12))).toBe(2);
    expect(recencyPoints(iso(48))).toBe(1);
    expect(recencyPoints(iso(200))).toBe(0.25);
  });

  it("caps source count points at 3", () => {
    expect(sourceCountPoints(0)).toBe(0);
    expect(sourceCountPoints(1)).toBe(1);
    expect(sourceCountPoints(2)).toBe(2);
    expect(sourceCountPoints(9)).toBe(3);
  });

  it("scores city events lower in scope than country and region events", () => {
    expect(geoScopePoints("city")).toBeLessThan(geoScopePoints("country"));
    expect(geoScopePoints("country")).toBeLessThan(geoScopePoints("region"));
  });

  it("weights heavy categories higher", () => {
    expect(categoryWeight(["armed-conflict"])).toBe(1.5);
    expect(categoryWeight(["cybersecurity"])).toBe(1.2);
    expect(categoryWeight(["technology"])).toBe(1);
  });

  it("maps scores to levels with routine as the default", () => {
    expect(levelForScore(2)).toBe("routine");
    expect(levelForScore(8)).toBe("notable");
    expect(levelForScore(13)).toBe("critical");
  });

  it("keeps a single fresh city-level news event out of the critical band", () => {
    const score = scoreEvent({
      lastUpdatedAt: new Date().toISOString(),
      distinctSources: 1,
      bestSourceQuality: 1,
      primaryGeoKind: "city",
      topics: ["geopolitics"],
    });
    expect(score.level).toBe("routine");
    expect(score.factors.sourceCount).toBe(1);
  });

  it("escalates a multi-source disaster with official confirmation", () => {
    const score = scoreEvent({
      lastUpdatedAt: new Date().toISOString(),
      distinctSources: 4,
      bestSourceQuality: 2,
      primaryGeoKind: "region",
      topics: ["natural-disaster"],
    });
    expect(score.score).toBeGreaterThanOrEqual(13);
    expect(score.level).toBe("critical");
  });

  it("exposes every factor for auditing", () => {
    const score = scoreEvent({
      lastUpdatedAt: new Date().toISOString(),
      distinctSources: 2,
      bestSourceQuality: 2,
      primaryGeoKind: "country",
      topics: ["diplomacy"],
    });
    expect(Object.keys(score.factors).sort()).toEqual(
      ["categoryWeight", "geoScope", "recency", "sourceCount", "sourceQuality"].sort(),
    );
  });
});

describe("geo resolution", () => {
  it("resolves a country mention with country precision only", () => {
    const geo = resolveGeoFromText("Ministers meet in Nairobi to discuss regional trade");
    expect(geo.length).toBeGreaterThan(0);
    const city = geo.find((g) => g.kind === "city");
    expect(city?.name).toBe("Nairobi");
    expect(city?.country).toBe("Kenya");
    expect(city?.precisionRadiusKm).toBeGreaterThan(10);
  });

  it("resolves aliases such as UAE and UK", () => {
    expect(resolveGeoFromText("Talks held in the UAE this week").some((g) => g.country === "United Arab Emirates")).toBe(true);
    expect(resolveGeoFromText("A vote in the UK parliament").some((g) => g.country === "United Kingdom")).toBe(true);
  });

  it("respects word boundaries", () => {
    // "china" inside a longer token must not match
    const geo = resolveGeoFromText("The chinaware exhibition opens");
    expect(geo.some((g) => g.country === "China")).toBe(false);
  });

  it("maps countries to regions", () => {
    expect(countryToRegion("Kenya")).toBe("africa");
    expect(countryToRegion("Japan")).toBe("east-asia");
    expect(countryToRegion("Nowhere")).toBeUndefined();
  });

  it("computes plausible haversine distances", () => {
    // London → Paris ≈ 344 km
    const d = distanceKm(51.51, -0.13, 48.86, 2.35);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(400);
  });

  it("reverse-geocodes a coordinate to a city-level place", () => {
    const place = nearestPlace(48.87, 2.34); // near Paris
    expect(place?.name).toBe("Paris");
    expect(place?.country).toBe("France");
    expect(place?.region).toBe("europe");
  });

  it("falls back to nearest country when no city is close", () => {
    const place = nearestPlace(-3.5, 20.0); // remote DR Congo area
    expect(place).not.toBeNull();
    expect(place?.name).toBe("DR Congo");
    expect(place?.country).toBe("DR Congo");
  });
});

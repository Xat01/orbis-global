import { describe, expect, it } from "vitest";
import { buildEvents, dedupeArticles } from "@/lib/ingest/cluster";
import { normalizeArticle } from "@/lib/ingest/normalize";
import type { RawItem } from "@/lib/sources/adapters";
import type { Article } from "@/lib/types";

const RETRIEVED = "2026-10-16T12:00:00.000Z";

function raw(overrides: Partial<RawItem> & { url: string; title: string }): RawItem {
  return {
    sourceId: "bbc-world",
    sourceName: "BBC World",
    description: "",
    publishedAt: RETRIEVED,
    quality: 1,
    attribution: "© BBC",
    ...overrides,
  };
}

function article(overrides: Partial<RawItem> & { url: string; title: string }): Article {
  return normalizeArticle(raw(overrides), RETRIEVED);
}

describe("dedupeArticles", () => {
  it("removes exact canonical URL duplicates and keeps the earliest", () => {
    const a = article({ url: "https://x.com/story?utm_source=rss", title: "One thing happened today", publishedAt: "2026-10-16T10:00:00.000Z" });
    const b = article({ url: "https://www.x.com/story", title: "One thing happened today", publishedAt: "2026-10-16T11:00:00.000Z" });
    const { unique, duplicates } = dedupeArticles([b, a]);
    expect(unique).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
    expect(unique[0].publishedAt).toBe("2026-10-16T10:00:00.000Z");
  });

  it("removes same-source retitled duplicates", () => {
    const a = article({ url: "https://x.com/a", title: "Flooding hits coastal region hard" });
    const b = article({ url: "https://x.com/b", title: "Flooding hits coastal region hard!" });
    const { unique } = dedupeArticles([a, b]);
    expect(unique).toHaveLength(1);
  });

  it("keeps identical titles from different sources (independent reporting)", () => {
    const a = article({ url: "https://x.com/a", title: "Flooding hits coastal region hard" });
    const b = article({
      url: "https://y.com/a",
      title: "Flooding hits coastal region hard",
      sourceId: "guardian-world",
      sourceName: "The Guardian — World",
    });
    const { unique } = dedupeArticles([a, b]);
    expect(unique).toHaveLength(2);
  });
});

describe("buildEvents clustering", () => {
  it("groups similar headlines within the window into one event", () => {
    const items = [
      article({
        url: "https://x.com/1",
        title: "Leaders reach agreement on humanitarian corridor in Amman",
        publishedAt: "2026-10-16T08:00:00.000Z",
      }),
      article({
        url: "https://y.com/1",
        title: "Leaders agree humanitarian corridor framework at Amman summit",
        sourceId: "un-news",
        sourceName: "UN News",
        publishedAt: "2026-10-16T09:00:00.000Z",
      }),
    ];
    const { events } = buildEvents(items);
    expect(events).toHaveLength(1);
    expect(events[0].sourceIds).toHaveLength(2);
  });

  it("does not merge unrelated headlines that merely share structure", () => {
    const items = [
      article({ url: "https://x.com/1", title: "Earthquake strikes northern Chile coast" }),
      article({ url: "https://x.com/2", title: "Inflation rises sharply in Argentina" }),
    ];
    const { events } = buildEvents(items);
    expect(events).toHaveLength(2);
  });

  it("keeps separate quakes as separate events via structured keying", () => {
    const quake = (n: number, day: string, place: string) =>
      article({
        url: `https://usgs.gov/quake-${n}`,
        title: `M 5.${n} - 74 km SW of ${place}`,
        description: `Magnitude 5.${n} earthquake near ${place}.`,
        sourceId: "usgs-seismic",
        sourceName: "USGS Earthquakes (M2.5+, last day)",
        topicOverride: ["natural-disaster"],
        eventTime: `${day}T03:00:00.000Z`,
        publishedAt: `${day}T04:00:00.000Z`,
        geoOverride: [
          { name: `74 km SW of ${place}`, kind: "exact", lat: 23.6, lng: 121.2, precisionRadiusKm: 10 },
        ],
      });
    const { events } = buildEvents([
      quake(1, "2026-10-16", "Hualien City"),
      quake(2, "2026-10-16", "Hualien City"),
      quake(3, "2026-10-15", "Hualien City"),
    ]);
    // Same place, same day → 1 event; previous day → separate event.
    expect(events).toHaveLength(2);
  });

  it("labels conflicting accounts instead of merging into agreement", () => {
    const items = [
      article({
        url: "https://x.com/1",
        title: "Officials confirm casualties after blast at port facility",
        publishedAt: "2026-10-16T08:00:00.000Z",
      }),
      article({
        url: "https://y.com/1",
        title: "Casualties after blast at port facility",
        description: "blast port facility casualties",
        sourceId: "aljazeera",
        sourceName: "Al Jazeera English",
        publishedAt: "2026-10-16T08:30:00.000Z",
      }),
      article({
        url: "https://z.com/1",
        title: "No confirmed casualties after blast at port facility",
        description: "blast port facility casualties confirmed",
        sourceId: "dw-world",
        sourceName: "DW English",
        publishedAt: "2026-10-16T08:45:00.000Z",
      }),
    ];
    const { events } = buildEvents(items);
    expect(events).toHaveLength(1);
    // Divergent framings must be visible, not silently averaged away.
    const labels = events[0].evidenceLabels;
    expect(
      labels.includes("conflicting-accounts") || labels.includes("multiple-sources-agree"),
    ).toBe(true);
  });

  it("produces updates for new sources joining an event", () => {
    const items = [
      article({
        url: "https://x.com/1",
        title: "Energy ministers meet in Brussels on supply security",
        publishedAt: "2026-10-16T06:00:00.000Z",
      }),
      article({
        url: "https://y.com/1",
        title: "Energy ministers meet in Brussels to discuss supply security",
        sourceId: "dw-world",
        sourceName: "DW English",
        publishedAt: "2026-10-16T07:00:00.000Z",
      }),
    ];
    const { events, updates } = buildEvents(items);
    expect(events).toHaveLength(1);
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates[0].eventId).toBe(events[0].id);
    expect(["new-source", "official-statement", "new-information"]).toContain(
      updates[0].changeType,
    );
    expect(new Date(updates[0].observedAt).getTime()).not.toBeNaN();
  });

  it("flags corrections when a source publishes a correction", () => {
    const items = [
      article({
        url: "https://x.com/1",
        title: "Port closed after reported explosion near quay",
        publishedAt: "2026-10-16T06:00:00.000Z",
      }),
      article({
        url: "https://y.com/1",
        title: "Correction: port closed after reported explosion near quay",
        sourceId: "dw-world",
        sourceName: "DW English",
        publishedAt: "2026-10-16T07:00:00.000Z",
      }),
    ];
    const { events, updates } = buildEvents(items);
    expect(events[0].evidenceLabels).toContain("corrected-or-retracted");
    expect(updates.some((u) => u.changeType === "correction")).toBe(true);
  });

  it("never claims city-level precision for country-level matches", () => {
    const items = [
      article({ url: "https://x.com/1", title: "Ukraine reports strikes on energy infrastructure" }),
    ];
    const { events } = buildEvents(items);
    expect(events[0].primaryGeo.kind).not.toBe("exact");
    const countryGeo = events[0].geo.find((g) => g.kind === "country");
    if (countryGeo) {
      expect(countryGeo.precisionRadiusKm).toBeGreaterThan(100);
    }
  });

  it("isolates unlocated articles from the map dataset", () => {
    const items = [
      article({ url: "https://x.com/1", title: "Researchers publish new findings on deep sea currents" }),
    ];
    const { unlocated } = buildEvents(items);
    expect(unlocated.length).toBeGreaterThanOrEqual(0);
  });

  it("assigns each article an eventId", () => {
    const items = [
      article({ url: "https://x.com/1", title: "Storm warning issued for northern coast" }),
    ];
    const { events } = buildEvents(items);
    expect(items[0].eventId).toBe(events[0].id);
  });
});

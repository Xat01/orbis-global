import type { Snapshot } from "@/lib/types";
import { isAiConfigured } from "@/lib/env";
import { buildSources } from "@/lib/sources/registry";
import { normalizeArticle } from "@/lib/ingest/normalize";
import { buildEvents, dedupeArticles } from "@/lib/ingest/cluster";
import { toIso } from "@/lib/util/time";
import type { RawItem } from "@/lib/sources/adapters";

// ---------------------------------------------------------------------------
// FIXTURE DATA — used ONLY when ORBIS_E2E=1 (automated tests).
// These are synthetic items processed through the REAL pipeline code paths.
// The UI shows a persistent "test fixture mode" banner whenever this data is
// served, so demonstration data can never be mistaken for live intelligence.
// ---------------------------------------------------------------------------

function hoursAgo(h: number): string {
  return toIso(Date.now() - h * 3_600_000);
}

export const FIXTURE_RAW_ITEMS: RawItem[] = [
  {
    sourceId: "bbc-world",
    sourceName: "BBC World",
    url: "https://www.bbc.com/news/fixtures/summit-agreement-1",
    title: "Regional leaders reach preliminary agreement on humanitarian corridor",
    description: "Leaders meeting in Amman agreed on principles for a humanitarian corridor, officials said.",
    publishedAt: hoursAgo(2),
    quality: 1,
    attribution: "© BBC",
  },
  {
    sourceId: "un-news",
    sourceName: "UN News",
    url: "https://news.un.org/en/fixtures/humanitarian-corridor-agreed",
    title: "United Nations welcomes agreement on humanitarian corridor in Amman talks",
    description: "The UN Secretary-General welcomed the preliminary agreement reached by regional leaders in Amman.",
    publishedAt: hoursAgo(3),
    quality: 2,
    attribution: "© United Nations",
  },
  {
    sourceId: "aljazeera",
    sourceName: "Al Jazeera English",
    url: "https://www.aljazeera.com/news/fixtures/humanitarian-corridor-amman",
    title: "Leaders agree on humanitarian corridor framework after Amman summit",
    description: "Talks in Amman concluded with a framework agreement on a humanitarian corridor.",
    publishedAt: hoursAgo(4),
    quality: 1,
    attribution: "© Al Jazeera",
  },
  {
    sourceId: "usgs-seismic",
    sourceName: "USGS Earthquakes (M2.5+, last day)",
    url: "https://earthquake.usgs.gov/earthquakes/fixtures/eq-1",
    title: "M 5.6 - 74 km SW of Hualien City, Taiwan",
    description: "Magnitude 5.6 earthquake. Depth 22.0 km. Reported location: 74 km SW of Hualien City, Taiwan.",
    publishedAt: hoursAgo(5),
    eventTime: hoursAgo(6),
    geoOverride: [{ name: "74 km SW of Hualien City, Taiwan", kind: "exact", lat: 23.6, lng: 121.2, precisionRadiusKm: 11 }],
    topicOverride: ["natural-disaster"],
    quality: 2,
    attribution: "USGS Earthquake Hazards Program",
  },
  {
    sourceId: "guardian-world",
    sourceName: "The Guardian — World",
    url: "https://www.theguardian.com/fixtures/central-bank-rates",
    title: "Central bank holds interest rates as inflation cools across the region",
    description: "Policymakers kept rates unchanged, citing easing inflation and weak demand.",
    publishedAt: hoursAgo(9),
    quality: 1,
    attribution: "© The Guardian",
  },
  {
    sourceId: "cisa-kev",
    sourceName: "CISA Known Exploited Vulnerabilities",
    url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    title: "CISA: CVE-2026-10001 — Remote code execution in enterprise file transfer suite",
    description: "AcmeSoft MoveIt-style transfer suite. Active exploitation observed. Required action: apply vendor patch.",
    publishedAt: hoursAgo(14),
    topicOverride: ["cybersecurity"],
    quality: 2,
    attribution: "CISA (public domain)",
  },
  {
    sourceId: "dw-world",
    sourceName: "DW English",
    url: "https://www.dw.com/en/fixtures/europe-energy-meeting",
    title: "European ministers meet in Brussels to discuss energy security",
    description: "Energy ministers gathered in Brussels for talks on winter supply resilience.",
    publishedAt: hoursAgo(20),
    quality: 1,
    attribution: "© Deutsche Welle",
  },
  {
    sourceId: "bbc-world",
    sourceName: "BBC World",
    url: "https://www.bbc.com/news/world-europe-99999", // near-duplicate of Guardian story, different words
    title: "Energy security talks open in Brussels amid supply concerns",
    description: "Ministers opened a two-day meeting on energy security in Brussels.",
    publishedAt: hoursAgo(19),
    quality: 1,
    attribution: "© BBC",
  },
];

let cached: Snapshot | null = null;

export function loadFixtureSnapshot(): Snapshot {
  if (cached) return cached;
  const retrievedAt = toIso(Date.now());
  const articles = FIXTURE_RAW_ITEMS.map((r) => normalizeArticle(r, retrievedAt));
  const { unique } = dedupeArticles(articles);
  const { events, updates } = buildEvents(unique);
  events.sort((a, b) => b.significance.score - a.significance.score);

  const sources = buildSources().map((s) => ({
    id: s.id,
    name: s.name,
    homepage: s.homepage,
    feedUrl: s.feedUrl,
    type: s.type,
    coverage: s.coverage,
    topics: s.topics,
    attribution: s.attribution,
    enabled: true,
    lastRetrievedAt: retrievedAt,
    lastStatus: "ok" as const,
    lastError: null,
    itemCount: FIXTURE_RAW_ITEMS.filter((r) => r.sourceId === s.id).length,
  }));

  cached = {
    meta: {
      generatedAt: retrievedAt,
      stale: false,
      fixtureMode: true,
      aiConfigured: isAiConfigured(),
      errors: [],
    },
    sources,
    articles: unique,
    events,
    updates,
  };
  return cached;
}

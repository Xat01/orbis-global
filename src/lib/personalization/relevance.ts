import type { Event, UserPreferences } from "@/lib/types";

// ---------------------------------------------------------------------------
// Location-aware relevance.
//
// Privacy note: matching runs client-side against preferences stored in
// localStorage. Coordinates are used only for city-level matching; country
// and region matches are textual.
// ---------------------------------------------------------------------------

export interface RelevanceResult {
  score: number;
  nearUserLocation: boolean; // true ONLY with city-level evidence
  sameCountry: boolean;
  sameRegion: boolean;
  topicMatch: boolean;
}

const LEVEL_ORDER = { critical: 3, notable: 2, routine: 1 } as const;

export function scoreEventForUser(
  event: Event,
  prefs: UserPreferences | null | undefined,
): RelevanceResult {
  let score = event.significance.score / 10; // base: intrinsic significance
  let near = false;
  let sameCountry = false;
  let sameRegion = false;
  let topicMatch = false;

  if (prefs?.location) {
    const loc = prefs.location;
    const names = event.geo.map((g) => g.name.toLowerCase());
    const countries = event.geo.map((g) => (g.country ?? "").toLowerCase());
    const locationName = loc.name.toLowerCase();
    const countryName = loc.country.toLowerCase();

    if (names.includes(locationName)) {
      near = true;
      score += 3;
    }
    if (countries.includes(countryName) || names.includes(countryName)) {
      sameCountry = true;
      score += 2;
    }
    if (event.primaryGeo.region === loc.region) {
      sameRegion = true;
      score += 1;
    }
  }

  if (prefs?.topics?.length) {
    if (event.categories.some((c) => prefs.topics.includes(c))) {
      topicMatch = true;
      score += 1.5;
    }
  }

  return { score, nearUserLocation: near, sameCountry, sameRegion, topicMatch };
}

export function compareByRelevance(
  prefs: UserPreferences | null | undefined,
): (a: Event, b: Event) => number {
  return (a, b) => {
    const ra = scoreEventForUser(a, prefs);
    const rb = scoreEventForUser(b, prefs);
    if (Math.abs(ra.score - rb.score) > 0.01) return rb.score - ra.score;
    // Tie-break: higher intrinsic significance, then more recent.
    const lvl = LEVEL_ORDER[b.significance.level] - LEVEL_ORDER[a.significance.level];
    if (lvl !== 0) return lvl;
    return b.lastUpdatedAt.localeCompare(a.lastUpdatedAt);
  };
}

import type { LocationPrecision, Significance, SignificanceLevel, Topic } from "@/lib/types";
import { hoursSince } from "@/lib/util/time";

// ---------------------------------------------------------------------------
// Transparent significance scoring.
//
// score = (recency + sourceCount + sourceQuality + geoScope) × categoryWeight
//
// The formula and thresholds are published verbatim on the
// Sources & Methodology page. Thresholds are deliberately conservative:
// most events are routine, which is honest — not every development is critical.
// ---------------------------------------------------------------------------

export const CRITICAL_THRESHOLD = 13;
export const NOTABLE_THRESHOLD = 8;

const CATEGORY_WEIGHTS: Partial<Record<Topic, number>> = {
  "armed-conflict": 1.5,
  "natural-disaster": 1.5,
  "public-health": 1.5,
  cybersecurity: 1.2,
  diplomacy: 1.2,
  geopolitics: 1.2,
  economics: 1.2,
};

export function recencyPoints(lastUpdatedAt: string, now: number = Date.now()): number {
  const h = hoursSince(lastUpdatedAt, now);
  if (h <= 6) return 3;
  if (h <= 24) return 2;
  if (h <= 72) return 1;
  return 0.25;
}

export function sourceCountPoints(distinctSources: number): number {
  if (distinctSources >= 3) return 3;
  if (distinctSources === 2) return 2;
  if (distinctSources === 1) return 1;
  return 0;
}

export function sourceQualityPoints(bestSourceQuality: number): number {
  return bestSourceQuality >= 2 ? 2 : 1;
}

export function geoScopePoints(kind: LocationPrecision): number {
  switch (kind) {
    case "exact":
    case "city":
    case "admin":
      return 0.75;
    case "country":
      return 1;
    case "region":
      return 1.5;
    case "uncertain":
      return 1;
    default:
      return 1;
  }
}

export function categoryWeight(topics: Topic[]): number {
  let max = 1;
  for (const t of topics) {
    const w = CATEGORY_WEIGHTS[t];
    if (w && w > max) max = w;
  }
  return max;
}

export function levelForScore(score: number): SignificanceLevel {
  if (score >= CRITICAL_THRESHOLD) return "critical";
  if (score >= NOTABLE_THRESHOLD) return "notable";
  return "routine";
}

export function scoreEvent(input: {
  lastUpdatedAt: string;
  distinctSources: number;
  bestSourceQuality: number;
  primaryGeoKind: LocationPrecision;
  topics: Topic[];
  now?: number;
}): Significance {
  const recency = recencyPoints(input.lastUpdatedAt, input.now ?? Date.now());
  const sourceCount = sourceCountPoints(input.distinctSources);
  const sourceQuality = sourceQualityPoints(input.bestSourceQuality);
  const geoScope = geoScopePoints(input.primaryGeoKind);
  const weight = categoryWeight(input.topics);
  const score = Number(((recency + sourceCount + sourceQuality + geoScope) * weight).toFixed(2));
  return {
    score,
    level: levelForScore(score),
    factors: { recency, sourceCount, sourceQuality, geoScope, categoryWeight: weight },
  };
}

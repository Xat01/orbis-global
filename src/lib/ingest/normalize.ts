import type { Article, GeoRef } from "@/lib/types";
import { resolveGeoFromText } from "@/lib/geo/gazetteer";
import { canonicalizeUrl, slugId } from "@/lib/util/text";
import { toIso } from "@/lib/util/time";
import { classifyTopics } from "@/lib/ingest/classify";
import type { RawItem } from "@/lib/sources/adapters";

// ---------------------------------------------------------------------------
// RawItem (adapter output) → Article (normalized core model)
// ---------------------------------------------------------------------------

export function normalizeArticle(raw: RawItem, retrievedAt: string): Article {
  const canonicalUrl = canonicalizeUrl(raw.url);
  const text = `${raw.title}. ${raw.description}`;
  const detected = resolveGeoFromText(text);
  const geo: GeoRef[] = raw.geoOverride
    ? [...raw.geoOverride, ...detected.filter((d) => d.kind !== "country")]
    : detected;

  // Prefer structured overrides (hazard feeds) over keyword classification.
  const topics = raw.topicOverride?.length
    ? raw.topicOverride
    : classifyTopics(text);

  const publishedAt =
    raw.publishedAt && !Number.isNaN(new Date(raw.publishedAt).getTime())
      ? toIso(raw.publishedAt)
      : toIso(retrievedAt);

  return {
    id: slugId("art", canonicalUrl),
    sourceId: raw.sourceId,
    sourceName: raw.sourceName,
    url: raw.url,
    canonicalUrl,
    title: raw.title,
    description: raw.description,
    publishedAt,
    retrievedAt: toIso(retrievedAt),
    language: raw.language ?? null,
    eventTime: raw.eventTime ? toIso(raw.eventTime) : null,
    topics: topics as Article["topics"],
    geo,
    eventId: null,
  };
}

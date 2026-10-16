import type {
  Article,
  ChangeType,
  EvidenceLabel,
  Event,
  EventStatus,
  EventUpdate,
  GeoRef,
  Topic,
} from "@/lib/types";
import { jaccard, normalizeTitle, slugId, tokenSet } from "@/lib/util/text";
import { toIso } from "@/lib/util/time";
import { scoreEvent } from "@/lib/ingest/significance";

// ---------------------------------------------------------------------------
// Deterministic deduplication + event clustering.
//
// Deduplication rules (in order):
//   1. identical canonical URL  → duplicate (keep earliest published)
//   2. same source + normalized-identical title → duplicate
//   3. same source + title similarity > 0.85 within 24h → live-update noise,
//      kept as the same event but NOT counted as new information
//
// Clustering rules:
//   - structured hazard items (exact geo + eventTime) cluster by
//     (place name, UTC day) — distinct quakes never merge
//   - otherwise: title-token similarity ≥ 0.42, or ≥ 0.28 with a shared
//     geographic anchor, within a 7-day window
//
// Conflicting perspectives are preserved: differing headlines within one
// event produce a "conflicting-accounts" evidence label rather than being
// merged away or silently dropped.
// ---------------------------------------------------------------------------

export const CLUSTER_JACCARD_HIGH = 0.42;
export const CLUSTER_JACCARD_GEO = 0.28;
export const EVENT_WINDOW_MS = 7 * 24 * 3_600_000;

export interface DedupeResult {
  unique: Article[];
  duplicates: Article[];
}

export function dedupeArticles(articles: Article[]): DedupeResult {
  const byCanonical = new Map<string, Article>();
  const bySourceTitle = new Map<string, string>(); // `${sourceId}|${normTitle}` → canonical
  const unique: Article[] = [];
  const duplicates: Article[] = [];

  const sorted = [...articles].sort((a, b) =>
    a.publishedAt < b.publishedAt ? -1 : a.publishedAt > b.publishedAt ? 1 : 0,
  );

  for (const article of sorted) {
    if (byCanonical.has(article.canonicalUrl)) {
      duplicates.push(article);
      continue;
    }
    const key = `${article.sourceId}|${normalizeTitle(article.title)}`;
    const existingCanonical = bySourceTitle.get(key);
    if (existingCanonical) {
      duplicates.push(article);
      continue;
    }
    byCanonical.set(article.canonicalUrl, article);
    bySourceTitle.set(key, article.canonicalUrl);
    unique.push(article);
  }
  return { unique, duplicates };
}

interface EventDraft {
  id: string;
  title: string;
  tokens: Set<string>;
  articles: Article[];
  geoNames: Set<string>;
  firstSeenAt: string;
  lastUpdatedAt: string;
  structuredKey?: string;
}

function geoNamesOf(a: Article): string[] {
  return a.geo.map((g) => g.name.toLowerCase());
}

function hasSharedGeo(a: Article, names: Set<string>): boolean {
  for (const n of geoNamesOf(a)) if (names.has(n)) return true;
  return false;
}

function structuredKeyOf(a: Article): string | null {
  // Hazard items with precise coordinates + known event time cluster by
  // (place, UTC day) so separate incidents never merge.
  const exact = a.geo.find((g) => g.kind === "exact");
  if (!exact || !a.eventTime) return null;
  const day = a.eventTime.slice(0, 10);
  return `${a.sourceId}|${exact.name.toLowerCase()}|${day}`;
}

const MAX_UPDATES_PER_EVENT = 12;

export interface ClusterResult {
  events: Event[];
  updates: EventUpdate[];
  unlocated: Article[]; // articles with no geo (still listed in news, not on map)
}

export function buildEvents(input: Article[]): ClusterResult {
  const sorted = [...input].sort((a, b) =>
    a.publishedAt < b.publishedAt ? -1 : a.publishedAt > b.publishedAt ? 1 : 0,
  );
  const drafts: EventDraft[] = [];
  const unlocated: Article[] = [];

  for (const article of sorted) {
    if (article.geo.length === 0) unlocated.push(article);

    // 1) structured clustering for precise hazard items
    const sKey = structuredKeyOf(article);
    let target: EventDraft | undefined;
    if (sKey) {
      target = drafts.find((d) => d.structuredKey === sKey);
    }

    // 2) similarity clustering — skipped for structured hazard items so that
    // distinct events (e.g. separate quakes) never merge on title similarity.
    if (!target && !sKey) {
      const tokens = tokenSet(`${article.title} ${article.description}`);
      const publishedMs = new Date(article.publishedAt).getTime();
      let best: { draft: EventDraft; score: number } | null = null;
      for (const draft of drafts) {
        const draftMs = new Date(draft.lastUpdatedAt).getTime();
        if (Math.abs(publishedMs - draftMs) > EVENT_WINDOW_MS) continue;
        const sim = jaccard(tokens, draft.tokens);
        const geoMatch = hasSharedGeo(article, draft.geoNames);
        const passes =
          sim >= CLUSTER_JACCARD_HIGH ||
          (sim >= CLUSTER_JACCARD_GEO && (geoMatch || article.geo.length === 0));
        if (passes && (!best || sim > best.score)) best = { draft, score: sim };
      }
      target = best?.draft;
    }

    if (!target) {
      const tokens = tokenSet(`${article.title} ${article.description}`);
      target = {
        id: slugId("evt", article.canonicalUrl),
        title: article.title,
        tokens,
        articles: [article],
        geoNames: new Set(geoNamesOf(article)),
        firstSeenAt: article.publishedAt,
        lastUpdatedAt: article.publishedAt,
        structuredKey: sKey ?? undefined,
      };
      drafts.push(target);
    } else {
      target.articles.push(article);
      for (const n of geoNamesOf(article)) target.geoNames.add(n);
      if (article.publishedAt > target.lastUpdatedAt) {
        target.lastUpdatedAt = article.publishedAt;
      }
    }
    article.eventId = target.id;
  }

  const updates: EventUpdate[] = [];
  const events: Event[] = drafts.map((draft) => {
    const ev = finalizeEvent(draft);
    updates.push(...buildUpdates(draft, ev));
    return ev;
  });

  // Update-based status adjustments (conflicting accounts → "unclear").
  for (const ev of events) {
    if (ev.evidenceLabels.includes("conflicting-accounts")) ev.status = "unclear";
  }

  return { events, updates, unlocated };
}

const PRECISION_RANK: Record<string, number> = {
  exact: 5,
  city: 4,
  admin: 3,
  country: 2,
  region: 1,
  uncertain: 0,
};

function pickPrimaryGeo(geo: GeoRef[]): GeoRef {
  let best = geo[0];
  for (const g of geo) {
    if ((PRECISION_RANK[g.kind] ?? 0) > (PRECISION_RANK[best.kind] ?? 0)) best = g;
  }
  return best;
}

function computeEvidenceLabels(articles: Article[], hasCorrection: boolean): EvidenceLabel[] {
  const labels = new Set<EvidenceLabel>();
  const sourceIds = new Set(articles.map((a) => a.sourceId));
  if (sourceIds.size >= 3) labels.add("multiple-sources-agree");
  else if (sourceIds.size === 1) labels.add("single-source");

  // "agree" is only claimed when headlines are substantially similar.
  if (labels.has("multiple-sources-agree")) {
    const titles = articles.slice(0, 6).map((a) => tokenSet(a.title));
    let minSim = 1;
    for (let i = 0; i < titles.length; i++) {
      for (let j = i + 1; j < titles.length; j++) {
        minSim = Math.min(minSim, jaccard(titles[i], titles[j]));
      }
    }
    if (titles.length >= 2 && minSim < 0.15) {
      labels.delete("multiple-sources-agree");
      labels.add("conflicting-accounts");
    }
  }

  const newest = articles[articles.length - 1];
  if (newest && Date.now() - new Date(newest.publishedAt).getTime() < 6 * 3_600_000) {
    labels.add("developing");
  }
  if (hasCorrection) labels.add("corrected-or-retracted");
  return [...labels];
}

function finalizeEvent(draft: EventDraft): Event {
  const articles = draft.articles;
  const sourceIds = [...new Set(articles.map((a) => a.sourceId))];
  const sourceNames = [...new Set(articles.map((a) => a.sourceName))];
  const allGeo: GeoRef[] = [];
  const seenGeo = new Set<string>();
  for (const a of articles) {
    for (const g of a.geo) {
      const key = `${g.kind}:${g.name.toLowerCase()}`;
      if (!seenGeo.has(key)) {
        seenGeo.add(key);
        allGeo.push(g);
      }
    }
  }
  const primaryGeo = allGeo.length ? pickPrimaryGeo(allGeo) : {
    name: "Location uncertain",
    kind: "uncertain" as const,
  };
  const categories = [...new Set(articles.flatMap((a) => a.topics))] as Topic[];
  const bestQuality = Math.max(...articles.map(qualityOf));
  const hasCorrection = articles.some((a) => /correct(?:ion|ed)?|retract/i.test(a.title));

  const newestPublished = articles[articles.length - 1].publishedAt;
  const status: EventStatus = hasCorrection ? "unclear" : "ongoing";

  const significance = scoreEvent({
    lastUpdatedAt: newestPublished,
    distinctSources: sourceIds.length,
    bestSourceQuality: bestQuality,
    primaryGeoKind: primaryGeo.kind,
    topics: categories,
  });

  return {
    id: draft.id,
    title: draft.title,
    summary: summarize(draft),
    categories,
    status,
    primaryGeo,
    geo: allGeo.slice(0, 6),
    firstSeenAt: draft.firstSeenAt,
    lastUpdatedAt: draft.lastUpdatedAt,
    articleIds: articles.map((a) => a.id),
    sourceIds,
    sourceNames,
    significance,
    evidenceLabels: computeEvidenceLabels(articles, hasCorrection),
  };
}

/**
 * Quality is attached in the pipeline via sourceName heuristics; article
 * objects themselves do not carry it. Official sources are recognised by ID
 * prefix conventions defined in the registry.
 */
function qualityOf(a: Article): number {
  return a.sourceId === "un-news" ||
    a.sourceId === "usgs-seismic" ||
    a.sourceId === "cisa-kev" ||
    a.sourceId === "reliefweb"
    ? 2
    : 1;
}

function summarize(draft: EventDraft): string {
  const n = draft.articles.length;
  const sources = [...new Set(draft.articles.map((a) => a.sourceName))];
  const srcText = sources.slice(0, 3).join(", ");
  return `${n} report${n === 1 ? "" : "s"} from ${srcText}${n > 3 ? " and others" : ""}.`;
}

function buildUpdates(draft: EventDraft, event: Event): EventUpdate[] {
  const updates: EventUpdate[] = [];
  const seenSources = new Set<string>();
  let previous: Article | null = null;

  for (const article of draft.articles) {
    if (updates.length >= MAX_UPDATES_PER_EVENT) break;
    if (article === draft.articles[0]) {
      seenSources.add(article.sourceId);
      previous = article;
      continue;
    }

    // Near-identical liveblog noise from the same source → not new information.
    if (previous && previous.sourceId === article.sourceId) {
      const sim = jaccard(tokenSet(previous.title), tokenSet(article.title));
      if (sim > 0.85) {
        previous = article;
        continue;
      }
    }

    let changeType: ChangeType;
    if (/correct(?:ion|ed)?|retract/i.test(article.title)) changeType = "correction";
    else if (!seenSources.has(article.sourceId) && qualityOf(article) === 2)
      changeType = "official-statement";
    else if (!seenSources.has(article.sourceId)) changeType = "new-source";
    else changeType = "new-information";

    // Meaningful location refinement: article pins a city where the event was
    // only known at country/region level.
    const refinesLocation =
      changeType === "new-information" &&
      article.geo.some((g) => g.kind === "city") &&
      event.primaryGeo.kind !== "city" &&
      event.primaryGeo.kind !== "exact";
    if (refinesLocation) changeType = "new-location";

    updates.push({
      id: slugId("upd", `${event.id}|${article.canonicalUrl}`),
      eventId: event.id,
      observedAt: toIso(Date.now()),
      eventTime: article.eventTime,
      publishedAt: article.publishedAt,
      changeType,
      description:
        changeType === "new-source"
          ? `New independent reporting from ${article.sourceName}: “${article.title}”.`
          : changeType === "official-statement"
            ? `Official/primary source ${article.sourceName} published: “${article.title}”.`
            : changeType === "correction"
              ? `${article.sourceName} published a correction/update: “${article.title}”.`
              : `${article.sourceName} updated its reporting: “${article.title}”.`,
      articleIds: [article.id],
      previousStatus: null,
      currentStatus: null,
    });
    seenSources.add(article.sourceId);
    previous = article;
  }

  return updates.reverse(); // most recent first
}

import { getSnapshot } from "@/lib/store/cache";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { REGIONS, TOPICS } from "@/lib/types";
import { freshnessOf, hoursSince } from "@/lib/util/time";

export const dynamic = "force-dynamic";

/**
 * GET /api/articles
 * Query: q, topic, region, sourceId, level, hours, limit, offset
 * Returns normalized articles enriched with their event's title/level and a
 * freshness bucket. Publication and retrieval times are both preserved.
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  const topic = url.searchParams.get("topic");
  const region = url.searchParams.get("region");
  const sourceId = url.searchParams.get("sourceId");
  const level = url.searchParams.get("level");
  const hours = Number(url.searchParams.get("hours") ?? "0");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "30"), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

  if (topic && !TOPICS.includes(topic as (typeof TOPICS)[number])) {
    return Response.json({ error: "invalid-topic" }, { status: 400 });
  }
  if (region && !REGIONS.includes(region as (typeof REGIONS)[number])) {
    return Response.json({ error: "invalid-region" }, { status: 400 });
  }

  const snapshot = await getSnapshot();
  const eventById = new Map(snapshot.events.map((e) => [e.id, e]));

  let rows = snapshot.articles.map((a) => {
    const event = a.eventId ? eventById.get(a.eventId) : undefined;
    return {
      ...a,
      eventTitle: event?.title ?? null,
      eventLevel: event?.significance.level ?? null,
      eventRegion: event?.primaryGeo.region ?? null,
      freshness: freshnessOf(a.publishedAt, a.retrievedAt),
    };
  });

  if (topic) rows = rows.filter((a) => a.topics.includes(topic as never));
  if (region) rows = rows.filter((a) => a.eventRegion === region || a.geo.some((g) => g.region === region));
  if (sourceId) rows = rows.filter((a) => a.sourceId === sourceId);
  if (level) rows = rows.filter((a) => a.eventLevel === level);
  if (Number.isFinite(hours) && hours > 0) {
    rows = rows.filter((a) => hoursSince(a.retrievedAt) <= hours);
  }
  if (q) {
    rows = rows.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.sourceName.toLowerCase().includes(q) ||
        a.geo.some((g) => g.name.toLowerCase().includes(q)),
    );
  }

  rows.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const total = rows.length;
  const paged = rows.slice(offset, offset + limit);

  return Response.json({
    articles: paged,
    total,
    offset,
    limit,
    meta: {
      generatedAt: snapshot.meta.generatedAt,
      stale: snapshot.meta.stale,
      fixtureMode: snapshot.meta.fixtureMode,
    },
  });
}

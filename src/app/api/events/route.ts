import { getSnapshot } from "@/lib/store/cache";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { REGIONS, SIGNIFICANCE_LEVELS, TOPICS } from "@/lib/types";
import { hoursSince } from "@/lib/util/time";

export const dynamic = "force-dynamic";

/**
 * GET /api/events
 * Query: topic, region, level, hours, q, limit, offset
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const url = new URL(request.url);
  const topic = url.searchParams.get("topic");
  const region = url.searchParams.get("region");
  const level = url.searchParams.get("level");
  const hours = Number(url.searchParams.get("hours") ?? "0");
  const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

  if (topic && !TOPICS.includes(topic as (typeof TOPICS)[number])) {
    return Response.json({ error: "invalid-topic" }, { status: 400 });
  }
  if (region && !REGIONS.includes(region as (typeof REGIONS)[number])) {
    return Response.json({ error: "invalid-region" }, { status: 400 });
  }
  if (level && !SIGNIFICANCE_LEVELS.includes(level as (typeof SIGNIFICANCE_LEVELS)[number])) {
    return Response.json({ error: "invalid-level" }, { status: 400 });
  }

  const snapshot = await getSnapshot();

  let events = snapshot.events;
  if (topic) events = events.filter((e) => e.categories.includes(topic as never));
  if (region) events = events.filter((e) => (e.primaryGeo.region ?? "global") === region);
  if (level) events = events.filter((e) => e.significance.level === level);
  if (Number.isFinite(hours) && hours > 0) {
    events = events.filter((e) => hoursSince(e.lastUpdatedAt) <= hours);
  }
  if (q) {
    events = events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.sourceNames.some((s) => s.toLowerCase().includes(q)) ||
        e.geo.some((g) => g.name.toLowerCase().includes(q)),
    );
  }

  const total = events.length;
  const paged = events.slice(offset, offset + limit);

  return Response.json({
    events: paged,
    total,
    offset,
    limit,
    meta: snapshot.meta,
  });
}

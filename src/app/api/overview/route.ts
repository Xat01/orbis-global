import { getSnapshot } from "@/lib/store/cache";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

/** GET /api/overview — dashboard payload (events, changes, regional + time aggregates). */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const snapshot = await getSnapshot();
  const now = Date.now();

  const events = [...snapshot.events]
    .sort((a, b) => b.significance.score - a.significance.score)
    .slice(0, 40);

  const updates = [...snapshot.updates]
    .sort((a, b) => (b.publishedAt ?? b.observedAt).localeCompare(a.publishedAt ?? a.observedAt))
    .slice(0, 60);

  // Hourly retrieval counts for the last 48 hours.
  const buckets = new Map<string, number>();
  for (let i = 47; i >= 0; i--) {
    const d = new Date(now - i * 3_600_000);
    buckets.set(d.toISOString().slice(0, 13), 0);
  }
  for (const a of snapshot.articles) {
    const key = a.retrievedAt.slice(0, 13);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const series = [...buckets.entries()].map(([hour, count]) => ({
    hour: `${hour.slice(11, 13)}:00`,
    count,
  }));

  const regionMap = new Map<string, { region: string; count: number; critical: number; notable: number }>();
  for (const e of snapshot.events) {
    const region = e.primaryGeo.region ?? "global";
    const row = regionMap.get(region) ?? { region, count: 0, critical: 0, notable: 0 };
    row.count += 1;
    if (e.significance.level === "critical") row.critical += 1;
    if (e.significance.level === "notable") row.notable += 1;
    regionMap.set(region, row);
  }

  return Response.json({
    generatedAt: snapshot.meta.generatedAt,
    stale: snapshot.meta.stale,
    fixtureMode: snapshot.meta.fixtureMode,
    aiConfigured: snapshot.meta.aiConfigured,
    errors: snapshot.meta.errors,
    eventCount: snapshot.events.length,
    articleCount: snapshot.articles.length,
    events,
    updates,
    series,
    byRegion: [...regionMap.values()].sort((a, b) => b.count - a.count),
    sources: snapshot.sources.map((s) => ({
      id: s.id,
      name: s.name,
      lastStatus: s.lastStatus,
      lastRetrievedAt: s.lastRetrievedAt,
      itemCount: s.itemCount,
    })),
  });
}

import { getVesselSnapshot } from "@/lib/vessels/cache";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/vessels
 * Live AIS vessel positions for the configured watch area.
 *
 * Query: limit (default 2000)
 *
 * Positions are collected in bounded passes (~15 s) and cached; while a pass is
 * in flight the response carries meta.refreshing = true and the UI re-polls.
 * Positions may be delayed, missing, or falsified. Not a navigational aid.
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "2000"), 1), 5000);
  const withinHours = Number(url.searchParams.get("withinHours") ?? "0");

  const snapshot = await getVesselSnapshot();

  let vessels = snapshot.vessels;
  if (Number.isFinite(withinHours) && withinHours > 0) {
    const cutoff = Date.now() - withinHours * 3_600_000;
    vessels = vessels.filter((v) => new Date(v.observedAt).getTime() >= cutoff);
  }
  if (vessels.length > limit) vessels = vessels.slice(0, limit);

  return Response.json(
    {
      vessels,
      meta: { ...snapshot.meta, count: vessels.length },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

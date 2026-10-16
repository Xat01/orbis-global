import { getSnapshot } from "@/lib/store/cache";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

/** GET /api/search?q=... — full-text search over events and articles (q required). */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const q = new URL(request.url).searchParams.get("q")?.toLowerCase()?.trim();
  if (!q || q.length < 2) return Response.json({ error: "missing-q" }, { status: 400 });
  if (q.length > 200) return Response.json({ error: "q-too-long" }, { status: 400 });

  const snapshot = await getSnapshot();

  const events = snapshot.events
    .filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.geo.some((g) => g.name.toLowerCase().includes(q)) ||
        e.sourceNames.some((s) => s.toLowerCase().includes(q)),
    )
    .slice(0, 15);

  const articles = snapshot.articles
    .filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.sourceName.toLowerCase().includes(q),
    )
    .slice(0, 15);

  return Response.json({ events, articles, meta: snapshot.meta });
}

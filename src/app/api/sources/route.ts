import { getSnapshot } from "@/lib/store/cache";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { buildSources, disabledSources } from "@/lib/sources/registry";

export const dynamic = "force-dynamic";

/** GET /api/sources — active source list with per-source status + disabled list. */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const snapshot = await getSnapshot();
  const configs = new Map(buildSources().map((s) => [s.id, s]));

  // Prefer live status from the snapshot; fall back to registry metadata.
  const byId = new Map(snapshot.sources.map((s) => [s.id, s]));
  const sources = [...configs.values()].map((config) => {
    const live = byId.get(config.id);
    return {
      id: config.id,
      name: config.name,
      homepage: config.homepage,
      feedUrl: config.feedUrl,
      type: config.type,
      coverage: config.coverage,
      topics: config.topics,
      attribution: config.attribution,
      lastRetrievedAt: live?.lastRetrievedAt ?? null,
      lastStatus: live?.lastStatus ?? "pending",
      lastError: live?.lastError ?? null,
      itemCount: live?.itemCount ?? 0,
    };
  });

  return Response.json({
    sources,
    disabled: disabledSources(),
    meta: {
      generatedAt: snapshot.meta.generatedAt,
      fixtureMode: snapshot.meta.fixtureMode,
      aiConfigured: snapshot.meta.aiConfigured,
      errors: snapshot.meta.errors,
    },
  });
}

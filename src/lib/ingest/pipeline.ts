import type { Article, Snapshot, SnapshotMeta, Source } from "@/lib/types";
import { isAiConfigured, isFixtureMode } from "@/lib/env";
import { buildSources } from "@/lib/sources/registry";
import { fetchSource } from "@/lib/sources/adapters";
import { normalizeArticle } from "@/lib/ingest/normalize";
import { buildEvents, dedupeArticles } from "@/lib/ingest/cluster";
import { loadFixtureSnapshot } from "@/lib/sources/fixtures";
import { toIso } from "@/lib/util/time";

// ---------------------------------------------------------------------------
// Ingestion pipeline.
//
// There is NO background scheduler: ingestion runs lazily when data is
// requested (stale-while-revalidate, see store/cache.ts) or manually via
// POST /api/ingest (token-protected) for external scheduling
// (e.g. Windows Task Scheduler + curl). This is documented in the README.
//
// Sources are fetched with bounded concurrency and isolated failures —
// one broken source never corrupts the rest of the data.
// ---------------------------------------------------------------------------

const CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runIngestion(): Promise<Snapshot> {
  if (isFixtureMode()) return loadFixtureSnapshot();

  const retrievedAt = toIso(Date.now());
  const configs = buildSources();

  const results = await mapWithConcurrency(configs, CONCURRENCY, async (config) => {
    try {
      const result = await fetchSource(config.config, retrievedAt);
      return { config, result };
    } catch (e) {
      return {
        config,
        result: {
          items: [],
          error: e instanceof Error ? e.message.slice(0, 200) : "unknown-error",
        },
      };
    }
  });

  const errors: Array<{ sourceId: string; error: string }> = [];
  const allArticles: Article[] = [];
  const sources: Source[] = results.map(({ config, result }) => {
    if (result.error) {
      errors.push({ sourceId: config.id, error: result.error });
    }
    for (const raw of result.items) {
      allArticles.push(normalizeArticle(raw, retrievedAt));
    }
    return {
      id: config.id,
      name: config.name,
      homepage: config.homepage,
      feedUrl: config.feedUrl,
      type: config.type,
      coverage: config.coverage,
      topics: config.topics,
      attribution: config.attribution,
      enabled: true,
      lastRetrievedAt: result.error ? null : retrievedAt,
      lastStatus: result.error ? "error" : result.items.length > 0 ? "ok" : "error",
      lastError: result.error ?? null,
      itemCount: result.items.length,
    };
  });

  const { unique } = dedupeArticles(allArticles);
  const { events, updates } = buildEvents(unique);

  events.sort((a, b) => b.significance.score - a.significance.score);

  const meta: SnapshotMeta = {
    generatedAt: retrievedAt,
    stale: false,
    fixtureMode: false,
    aiConfigured: isAiConfigured(),
    errors,
  };

  return { meta, sources, articles: unique, events, updates };
}

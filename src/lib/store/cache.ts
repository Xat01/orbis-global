import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Snapshot } from "@/lib/types";
import { SnapshotSchema } from "@/lib/types";
import { isFixtureMode } from "@/lib/env";
import { runIngestion } from "@/lib/ingest/pipeline";
import { loadFixtureSnapshot } from "@/lib/sources/fixtures";
import { toIso } from "@/lib/util/time";

// ---------------------------------------------------------------------------
// Snapshot store: in-memory cache + on-disk JSON cache with
// stale-while-revalidate semantics.
//
//   fresh  (< 20 min)  → served directly
//   stale  (< 6 h)     → served immediately with meta.stale = true, refreshed
//                        in the background (single-flight)
//   expired            → refreshed before responding; if the refresh fails and
//                        only expired data exists, an empty snapshot is
//                        returned with the error recorded (never fake data)
//
// No background daemon exists — a refresh only ever happens in response to a
// request (or the token-protected /api/ingest endpoint).
// ---------------------------------------------------------------------------

export const FRESH_MS = 20 * 60_000;
export const STALE_MS = 6 * 3_600_000;

const CACHE_DIR = path.join(process.cwd(), ".orbis-cache");
const CACHE_FILE = path.join(CACHE_DIR, "snapshot.json");

interface CacheState {
  snapshot: Snapshot | null;
  fetchedAt: number; // ms epoch of the snapshot's generatedAt
  inflight: Promise<Snapshot> | null;
  lastError: string | null;
  diskLoaded: boolean;
}

const globalStore = globalThis as unknown as { __orbisCache?: CacheState };

function state(): CacheState {
  if (!globalStore.__orbisCache) {
    globalStore.__orbisCache = {
      snapshot: null,
      fetchedAt: 0,
      inflight: null,
      lastError: null,
      diskLoaded: false,
    };
  }
  return globalStore.__orbisCache;
}

function emptySnapshot(error: string): Snapshot {
  return {
    meta: {
      generatedAt: toIso(Date.now()),
      stale: true,
      fixtureMode: false,
      aiConfigured: false,
      errors: [{ sourceId: "*", error }],
    },
    sources: [],
    articles: [],
    events: [],
    updates: [],
  };
}

async function loadFromDisk(s: CacheState): Promise<void> {
  if (s.diskLoaded) return;
  s.diskLoaded = true;
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const parsed = SnapshotSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      s.snapshot = parsed.data;
      s.fetchedAt = new Date(parsed.data.meta.generatedAt).getTime();
    }
  } catch {
    // No cache yet — normal on first run.
  }
}

async function persist(snapshot: Snapshot): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const tmp = `${CACHE_FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(snapshot), "utf8");
    await rename(tmp, CACHE_FILE); // atomic replace
  } catch {
    // Disk caching is best-effort; failure must not break the response.
  }
}

function refresh(s: CacheState): Promise<Snapshot> {
  if (s.inflight) return s.inflight;
  s.inflight = (async () => {
    try {
      const snapshot = await runIngestion();
      s.snapshot = snapshot;
      s.fetchedAt = Date.now();
      s.lastError = null;
      await persist(snapshot);
      return snapshot;
    } catch (e) {
      s.lastError = e instanceof Error ? e.message : "ingestion-failed";
      throw e;
    } finally {
      s.inflight = null;
    }
  })();
  return s.inflight;
}

function withStale(snapshot: Snapshot, stale: boolean): Snapshot {
  return { ...snapshot, meta: { ...snapshot.meta, stale } };
}

export async function getSnapshot(): Promise<Snapshot> {
  if (isFixtureMode()) return loadFixtureSnapshot();

  const s = state();
  await loadFromDisk(s);

  const age = Date.now() - s.fetchedAt;
  if (s.snapshot && age < FRESH_MS) return withStale(s.snapshot, false);

  if (s.snapshot && age < STALE_MS) {
    // Serve immediately; refresh in the background.
    void refresh(s).catch(() => undefined);
    return withStale(s.snapshot, true);
  }

  try {
    const fresh = await refresh(s);
    return withStale(fresh, false);
  } catch (e) {
    if (s.snapshot) return withStale(s.snapshot, true);
    return emptySnapshot(s.lastError ?? (e instanceof Error ? e.message : "ingestion-failed"));
  }
}

/** Force a refresh (used by POST /api/ingest). */
export async function forceRefresh(): Promise<Snapshot> {
  if (isFixtureMode()) return loadFixtureSnapshot();
  const s = state();
  const snapshot = await refresh(s);
  return withStale(snapshot, false);
}

/** Test helper. */
export function __resetCache(): void {
  globalStore.__orbisCache = undefined;
}

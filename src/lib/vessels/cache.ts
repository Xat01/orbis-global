import { rmSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { aisBoxes, isAisConfigured, isFixtureMode, validatedEnv } from "@/lib/env";
import { collectVessels, DEFAULT_WINDOW_MS, type VesselCollection } from "@/lib/vessels/ais";
import { fixtureVessels } from "@/lib/vessels/fixtures";
import { withNavalBadges } from "@/lib/vessels/naval";
import { VesselSchema, type Vessel, type VesselSnapshot } from "@/lib/vessels/types";
import { toIso } from "@/lib/util/time";

// ---------------------------------------------------------------------------
// Vessel store: in-memory cache + on-disk JSON, stale-while-revalidate.
//
// AIS positions move every few seconds, so freshness windows are short:
//   fresh  (< 1 min)  → served as-is
//   stale  (< 15 min) → served immediately, marked stale, refreshed in the
//                       background (single-flight)
//   older             → still served (labelled), a refresh is triggered
//
// A collection pass takes ~15 s, far too long to block an HTTP request, so the
// first request returns an empty, refreshing list and the UI polls until data
// arrives. There is no background daemon — a refresh only ever runs in
// response to a request.
// ---------------------------------------------------------------------------

export const VESSEL_FRESH_MS = 60_000;
export const VESSEL_STALE_MS = 15 * 60_000;

const CACHE_DIR = path.join(process.cwd(), ".orbis-cache");
const CACHE_FILE = path.join(CACHE_DIR, "vessels.json");
const MAX_PERSISTED = 2000;

interface VesselCacheState {
  vessels: Vessel[];
  generatedAt: number; // ms epoch of the last successful collection (0 = none)
  refreshing: boolean;
  lastError: string | null;
  diskLoaded: boolean;
}

type Collector = (options: {
  apiKey: string;
  boxes: ReturnType<typeof aisBoxes>;
}) => Promise<VesselCollection>;

const globalStore = globalThis as unknown as {
  __orbisVessels?: VesselCacheState;
  __orbisVesselCollector?: Collector;
};

function state(): VesselCacheState {
  if (!globalStore.__orbisVessels) {
    globalStore.__orbisVessels = {
      vessels: [],
      generatedAt: 0,
      refreshing: false,
      lastError: null,
      diskLoaded: false,
    };
  }
  return globalStore.__orbisVessels;
}

/** Test seam: substitute the network collector. */
export function __setVesselCollector(collector: Collector | null): void {
  globalStore.__orbisVesselCollector = collector ?? undefined;
}

/** Test helper: drops the in-memory state and any persisted snapshot. */
export function __resetVesselCache(): void {
  globalStore.__orbisVessels = undefined;
  globalStore.__orbisVesselCollector = undefined;
  try {
    rmSync(CACHE_FILE, { force: true });
  } catch {
    // Best effort — a leftover cache file must never fail a test run.
  }
}

async function loadFromDisk(): Promise<void> {
  const s = state();
  if (s.diskLoaded) return;
  s.diskLoaded = true;
  try {
    const raw = JSON.parse(await readFile(CACHE_FILE, "utf8")) as unknown;
    const parsed = raw as { generatedAt?: unknown; vessels?: unknown };
    if (typeof parsed.generatedAt !== "number" || !Array.isArray(parsed.vessels)) return;
    const vessels = parsed.vessels
      .map((v) => VesselSchema.safeParse(v))
      .filter((r) => r.success)
      .map((r) => r.data);
    if (vessels.length === 0) return;
    s.vessels = vessels;
    s.generatedAt = parsed.generatedAt;
  } catch {
    // No cache file yet, or it is unreadable/corrupt — start empty.
  }
}

async function saveToDisk(): Promise<void> {
  const s = state();
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const payload = JSON.stringify({
      generatedAt: s.generatedAt,
      vessels: s.vessels.slice(0, MAX_PERSISTED),
    });
    const tmp = `${CACHE_FILE}.${process.pid}.tmp`;
    await writeFile(tmp, payload, "utf8");
    await rename(tmp, CACHE_FILE);
  } catch {
    // A cache write failure must never break the request.
  }
}

let inflight: Promise<void> | null = null;

function refresh(): Promise<void> {
  if (inflight) return inflight;
  const s = state();
  s.refreshing = true;
  inflight = (async () => {
    try {
      const env = validatedEnv();
      if (!isAisConfigured(env)) {
        s.lastError = "ais-not-configured";
        return;
      }
      const collector = globalStore.__orbisVesselCollector;
      const result = collector
        ? await collector({ apiKey: env.AISSTREAM_API_KEY as string, boxes: aisBoxes(env) })
        : await collectVessels({ apiKey: env.AISSTREAM_API_KEY as string, boxes: aisBoxes(env) });

      // Only replace the cached set when a pass produced at least one position,
      // so a transient outage cannot erase the last-known picture.
      if (result.vessels.length > 0) {
        s.vessels = result.vessels;
        s.generatedAt = Date.now();
      }
      s.lastError = result.error;
      if (result.vessels.length > 0) await saveToDisk();
    } catch (e) {
      s.lastError = e instanceof Error ? e.message : "collection-failed";
    } finally {
      s.refreshing = false;
      inflight = null;
    }
  })();
  return inflight;
}

/** Badges are derived at serve time: allowlist edits apply immediately. */
function badge(vessels: Vessel[]): Vessel[] {
  return withNavalBadges(vessels, new Set(validatedEnv().ORBIS_AIS_NAVAL_MMSIS ?? []));
}

function fixtureSnapshot(): VesselSnapshot {
  const vessels = badge(fixtureVessels());
  const now = Date.now();
  return {
    meta: {
      generatedAt: toIso(now),
      stale: false,
      refreshing: false,
      fixtureMode: true,
      source: "fixture",
      count: vessels.length,
      windowSeconds: 0,
      boxes: aisBoxes(validatedEnv()),
      lastError: null,
    },
    vessels,
  };
}

/**
 * No AIS key: serve clearly-labelled demo positions so the maritime layer is
 * still explorable. The missing key stays visible in meta.lastError and the
 * UI labels the layer "demo" — this never masquerades as live AIS.
 */
function demoSnapshot(): VesselSnapshot {
  const vessels = badge(fixtureVessels());
  const now = Date.now();
  return {
    meta: {
      generatedAt: toIso(now),
      stale: false,
      refreshing: false,
      fixtureMode: false,
      source: "demo",
      count: vessels.length,
      windowSeconds: 0,
      boxes: aisBoxes(validatedEnv()),
      lastError: "ais-not-configured",
    },
    vessels,
  };
}

/** Return the current vessel picture, refreshing in the background when stale. */
export async function getVesselSnapshot(): Promise<VesselSnapshot> {
  if (isFixtureMode()) return fixtureSnapshot();
  if (!isAisConfigured()) return demoSnapshot();

  await loadFromDisk();
  const s = state();
  const now = Date.now();
  const age = s.generatedAt > 0 ? now - s.generatedAt : Number.POSITIVE_INFINITY;

  // Kick off (or join) a refresh when there is no data or it is no longer fresh.
  let refreshing = s.refreshing;
  if (!s.vessels.length || age > VESSEL_FRESH_MS) {
    void refresh();
    refreshing = true;
  }

  const configured = isAisConfigured();
  return {
    meta: {
      generatedAt: toIso(s.generatedAt > 0 ? s.generatedAt : now),
      stale: s.vessels.length > 0 && age > VESSEL_FRESH_MS,
      refreshing,
      fixtureMode: false,
      source: "aisstream",
      count: s.vessels.length,
      windowSeconds: DEFAULT_WINDOW_MS / 1000,
      boxes: aisBoxes(validatedEnv()),
      lastError: configured ? s.lastError : (s.lastError ?? "ais-not-configured"),
    },
    vessels: badge(s.vessels),
  };
}

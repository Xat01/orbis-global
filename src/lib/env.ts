// ---------------------------------------------------------------------------
// Environment validation.
//
// Every variable is OPTIONAL — ORBIS runs fully locally without any of them.
// Invalid values (e.g. a malformed base URL) fail loudly instead of being
// silently ignored. Secret values are never logged or returned to the client.
// ---------------------------------------------------------------------------

/** A geographic bounding box as [[south, west], [north, east]]. */
export type BoundingBox = [[number, number], [number, number]];

export interface OrbisEnv {
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  INGEST_TOKEN?: string;
  ORBIS_TILE_URL?: string;
  ORBIS_TILE_ATTRIBUTION?: string;
  ORBIS_RELIEFWEB_APPNAME?: string;
  /** AISStream.io API key — enables the live vessel layer (free, needs signup). */
  AISSTREAM_API_KEY?: string;
  /** Optional AIS subscription area; defaults to the Gulf/Red Sea corridor. */
  ORBIS_AIS_BOXES?: BoundingBox[];
  /** Optional user-maintained list of MMSIs known to be naval hulls. */
  ORBIS_AIS_NAVAL_MMSIS?: string[];
  ORBIS_E2E?: string;
}

function normalizeBaseUrl(raw: string | undefined, name: string): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("not-http");
    }
    // Strip trailing slash for predictable path joining.
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid ${name}: must be an absolute http(s) URL.`);
  }
}

function normalizeTileUrl(raw: string | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const value = raw.trim();
  // Template URL with {s}/{z}/{x}/{y} placeholders — validate the static parts.
  const probe = value
    .replace("{s}", "a")
    .replace("{z}", "1")
    .replace("{x}", "0")
    .replace("{y}", "0");
  try {
    const url = new URL(probe);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not-http");
    return value;
  } catch {
    throw new Error("Invalid ORBIS_TILE_URL: must be an http(s) tile template URL.");
  }
}

let cached: OrbisEnv | null = null;

/**
 * Default AIS watch area: the Gulf / Red Sea corridor (Strait of Hormuz through
 * Bab-el-Mandeb), one of the world's most consequential chokepoints. Used when
 * ORBIS_AIS_BOXES is not set. Vessel traffic outside this area is not collected.
 */
export const DEFAULT_AIS_BOXES: BoundingBox[] = [
  [
    [12, 32],
    [30.5, 57.5],
  ],
];

/**
 * Parse ORBIS_AIS_BOXES: a JSON array of [[south, west], [north, east]] boxes.
 * Malformed input fails loudly — a silently wrong watch area would be worse
 * than no vessel layer at all.
 */
export function parseAisBoxes(raw: string | undefined): BoundingBox[] | undefined {
  if (!raw || !raw.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid ORBIS_AIS_BOXES: must be JSON, e.g. [[[23,46.5],[30.5,57.5]]].");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Invalid ORBIS_AIS_BOXES: must be a non-empty array of boxes.");
  }
  return parsed.map((box, index) => {
    if (
      !Array.isArray(box) ||
      box.length !== 2 ||
      box.some((corner) => !Array.isArray(corner) || corner.length !== 2)
    ) {
      throw new Error(`Invalid ORBIS_AIS_BOXES[${index}]: expected [[south, west], [north, east]].`);
    }
    const [[south, west], [north, east]] = box as [[number, number], [number, number]];
    const numbers = [south, west, north, east];
    if (numbers.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
      throw new Error(`Invalid ORBIS_AIS_BOXES[${index}]: corners must be finite numbers.`);
    }
    if (south < -90 || north > 90 || west < -180 || east > 180 || south >= north) {
      throw new Error(`Invalid ORBIS_AIS_BOXES[${index}]: out-of-range or inverted corners.`);
    }
    return [
      [south, west],
      [north, east],
    ] as BoundingBox;
  });
}

/**
 * Parse ORBIS_AIS_NAVAL_MMSIS: a JSON array of MMSIs, or a comma/space
 * separated list of them. Entries must be 9-digit MMSIs — a typo would
 * silently badge the wrong ship as military, so malformed input fails loudly.
 * An empty list means "no listed hulls" and is not an error.
 */
export function parseNavalMmsis(raw: string | undefined): string[] | undefined {
  if (!raw || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  let entries: unknown[];
  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(
        "Invalid ORBIS_AIS_NAVAL_MMSIS: must be a JSON array of MMSIs or a comma-separated list.",
      );
    }
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid ORBIS_AIS_NAVAL_MMSIS: must be a list of MMSIs.");
    }
    if (parsed.length === 0) return undefined;
    entries = parsed;
  } else {
    entries = trimmed.split(/[\s,;]+/).filter(Boolean);
    if (entries.length === 0) return undefined;
  }
  const out = entries.map((entry, index) => {
    const value =
      typeof entry === "number" && Number.isInteger(entry)
        ? String(entry)
        : typeof entry === "string"
          ? entry.trim()
          : "";
    if (!/^\d{9}$/.test(value)) {
      throw new Error(`Invalid ORBIS_AIS_NAVAL_MMSIS[${index}]: MMSIs are exactly 9 digits.`);
    }
    return value;
  });
  return [...new Set(out)];
}

export function getEnv(source: Record<string, string | undefined> = process.env): OrbisEnv {
  const env: OrbisEnv = {
    AI_BASE_URL: normalizeBaseUrl(source.AI_BASE_URL, "AI_BASE_URL"),
    AI_API_KEY: source.AI_API_KEY?.trim() || undefined,
    AI_MODEL: source.AI_MODEL?.trim() || undefined,
    INGEST_TOKEN: source.INGEST_TOKEN?.trim() || undefined,
    ORBIS_TILE_URL: normalizeTileUrl(source.ORBIS_TILE_URL),
    ORBIS_TILE_ATTRIBUTION: source.ORBIS_TILE_ATTRIBUTION?.trim() || undefined,
    ORBIS_RELIEFWEB_APPNAME: source.ORBIS_RELIEFWEB_APPNAME?.trim() || undefined,
    AISSTREAM_API_KEY: source.AISSTREAM_API_KEY?.trim() || undefined,
    ORBIS_AIS_BOXES: parseAisBoxes(source.ORBIS_AIS_BOXES),
    ORBIS_AIS_NAVAL_MMSIS: parseNavalMmsis(source.ORBIS_AIS_NAVAL_MMSIS),
    ORBIS_E2E: source.ORBIS_E2E,
  };
  return env;
}

/** Validate on first use; throw with a clear message on bad configuration. */
export function validatedEnv(): OrbisEnv {
  if (!cached) cached = getEnv();
  return cached;
}

/** True only when a complete AI provider configuration exists. */
export function isAiConfigured(env: OrbisEnv = validatedEnv()): boolean {
  return Boolean(env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL);
}

/**
 * True when live vessel positions can be collected (AISStream key present).
 * Without a key the vessel layer serves clearly-labelled demo positions.
 */
export function isAisConfigured(env: OrbisEnv = validatedEnv()): boolean {
  return Boolean(env.AISSTREAM_API_KEY);
}

/** The active AIS watch area: explicit boxes when configured, else the default. */
export function aisBoxes(env: OrbisEnv = validatedEnv()): BoundingBox[] {
  return env.ORBIS_AIS_BOXES ?? DEFAULT_AIS_BOXES;
}

export function isFixtureMode(): boolean {
  return process.env.ORBIS_E2E === "1";
}

/** Test helper. */
export function __resetEnvCache(): void {
  cached = null;
}

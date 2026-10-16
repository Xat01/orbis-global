// ---------------------------------------------------------------------------
// Environment validation.
//
// Every variable is OPTIONAL — ORBIS runs fully locally without any of them.
// Invalid values (e.g. a malformed base URL) fail loudly instead of being
// silently ignored. Secret values are never logged or returned to the client.
// ---------------------------------------------------------------------------

export interface OrbisEnv {
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  INGEST_TOKEN?: string;
  ORBIS_TILE_URL?: string;
  ORBIS_TILE_ATTRIBUTION?: string;
  ORBIS_RELIEFWEB_APPNAME?: string;
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

export function getEnv(source: Record<string, string | undefined> = process.env): OrbisEnv {
  const env: OrbisEnv = {
    AI_BASE_URL: normalizeBaseUrl(source.AI_BASE_URL, "AI_BASE_URL"),
    AI_API_KEY: source.AI_API_KEY?.trim() || undefined,
    AI_MODEL: source.AI_MODEL?.trim() || undefined,
    INGEST_TOKEN: source.INGEST_TOKEN?.trim() || undefined,
    ORBIS_TILE_URL: normalizeTileUrl(source.ORBIS_TILE_URL),
    ORBIS_TILE_ATTRIBUTION: source.ORBIS_TILE_ATTRIBUTION?.trim() || undefined,
    ORBIS_RELIEFWEB_APPNAME: source.ORBIS_RELIEFWEB_APPNAME?.trim() || undefined,
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

export function isFixtureMode(): boolean {
  return process.env.ORBIS_E2E === "1";
}

/** Test helper. */
export function __resetEnvCache(): void {
  cached = null;
}

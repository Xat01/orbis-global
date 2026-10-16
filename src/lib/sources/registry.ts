import type { Region, Source, SourceType, Topic } from "@/lib/types";

// ---------------------------------------------------------------------------
// Source registry — the single allowlist of outbound feed URLs.
// Adapters may only fetch URLs listed here (defence against SSRF: dynamic
// URL fetching is never exposed to users).
//
// Verified reachable (2026-10-16) from the development environment.
// ---------------------------------------------------------------------------

export interface SourceConfig {
  id: string;
  name: string;
  homepage: string;
  feedUrl: string;
  type: SourceType;
  coverage: Region[];
  topics: Topic[];
  attribution: string;
  adapter: "rss" | "usgs" | "cisa-kev" | "reliefweb";
  /** quality weight for significance scoring */
  quality: number; // 1 = established news, 2 = official/primary
  enabledByDefault: boolean;
}

export const SOURCE_CONFIGS: SourceConfig[] = [
  {
    id: "bbc-world",
    name: "BBC World",
    homepage: "https://www.bbc.com/news/world",
    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
    type: "news-rss",
    coverage: ["global"],
    topics: ["geopolitics", "diplomacy", "armed-conflict", "economics", "public-health", "natural-disaster", "technology", "environment"],
    attribution: "© BBC",
    adapter: "rss",
    quality: 1,
    enabledByDefault: true,
  },
  {
    id: "aljazeera",
    name: "Al Jazeera English",
    homepage: "https://www.aljazeera.com",
    feedUrl: "https://www.aljazeera.com/xml/rss/all.xml",
    type: "news-rss",
    coverage: ["global"],
    topics: ["geopolitics", "diplomacy", "armed-conflict", "economics", "public-health"],
    attribution: "© Al Jazeera Media Network",
    adapter: "rss",
    quality: 1,
    enabledByDefault: true,
  },
  {
    id: "guardian-world",
    name: "The Guardian — World",
    homepage: "https://www.theguardian.com/international",
    feedUrl: "https://www.theguardian.com/world/rss",
    type: "news-rss",
    coverage: ["global"],
    topics: ["geopolitics", "environment", "economics", "technology", "public-health"],
    attribution: "© The Guardian",
    adapter: "rss",
    quality: 1,
    enabledByDefault: true,
  },
  {
    id: "un-news",
    name: "UN News",
    homepage: "https://news.un.org",
    feedUrl: "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
    type: "official-api",
    coverage: ["global"],
    topics: ["diplomacy", "public-health", "geopolitics"],
    attribution: "© United Nations",
    adapter: "rss",
    quality: 2,
    enabledByDefault: true,
  },
  {
    id: "dw-world",
    name: "DW English",
    homepage: "https://www.dw.com/en/",
    feedUrl: "https://rss.dw.com/rdf/rss-en-all",
    type: "news-rss",
    coverage: ["global"],
    topics: ["geopolitics", "diplomacy", "economics"],
    attribution: "© Deutsche Welle",
    adapter: "rss",
    quality: 1,
    enabledByDefault: true,
  },
  {
    id: "usgs-seismic",
    name: "USGS Earthquakes (M2.5+, last day)",
    homepage: "https://earthquake.usgs.gov/earthquakes/search/",
    feedUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
    type: "hazard-feed",
    coverage: ["global"],
    topics: ["natural-disaster"],
    attribution: "USGS Earthquake Hazards Program",
    adapter: "usgs",
    quality: 2,
    enabledByDefault: true,
  },
  {
    id: "cisa-kev",
    name: "CISA Known Exploited Vulnerabilities",
    homepage: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    feedUrl: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    type: "government-feed",
    coverage: ["north-america", "global"],
    topics: ["cybersecurity"],
    attribution: "CISA (public domain)",
    adapter: "cisa-kev",
    quality: 2,
    enabledByDefault: true,
  },
  {
    id: "reliefweb",
    name: "ReliefWeb Reports",
    homepage: "https://reliefweb.int",
    feedUrl: "https://api.reliefweb.int/v2/reports",
    type: "official-api",
    coverage: ["global"],
    topics: ["natural-disaster", "public-health", "armed-conflict"],
    attribution: "© ReliefWeb (OCHA)",
    adapter: "reliefweb",
    quality: 2,
    // Requires an approved appname from ReliefWeb (free, manual request).
    enabledByDefault: false,
  },
];

export function isEnabledByEnv(config: SourceConfig, env: Record<string, string | undefined>): boolean {
  const flag = `ORBIS_SOURCE_${config.id.toUpperCase().replace(/-/g, "_")}_DISABLED`;
  if (env[flag] === "1") return false;
  if (config.id === "reliefweb" && !env.ORBIS_RELIEFWEB_APPNAME) return false;
  return config.enabledByDefault;
}

/** Build the runtime source list with status fields. */
export function buildSources(
  env: Record<string, string | undefined> = process.env,
): Array<Omit<Source, "lastRetrievedAt" | "lastStatus" | "lastError" | "itemCount"> & { config: SourceConfig }> {
  return SOURCE_CONFIGS.filter((c) => isEnabledByEnv(c, env)).map((config) => ({
    id: config.id,
    name: config.name,
    homepage: config.homepage,
    feedUrl: config.feedUrl,
    type: config.type,
    coverage: config.coverage,
    topics: config.topics,
    attribution: config.attribution,
    enabled: true,
    config,
  }));
}

export function sourceConfigById(id: string): SourceConfig | undefined {
  return SOURCE_CONFIGS.find((c) => c.id === id);
}

/** Sources that exist in the registry but are not currently active, with the
 *  honest reason why (surfaced on the Sources & Methodology page). */
export function disabledSources(
  env: Record<string, string | undefined> = process.env,
): Array<{ id: string; name: string; homepage: string; reason: string }> {
  return SOURCE_CONFIGS.filter((c) => !isEnabledByEnv(c, env)).map((c) => {
    const flag = `ORBIS_SOURCE_${c.id.toUpperCase().replace(/-/g, "_")}_DISABLED`;
    const reason =
      env[flag] === "1"
        ? "Disabled via environment variable."
        : c.id === "reliefweb"
          ? "Requires an approved (free) ReliefWeb API appname. Set ORBIS_RELIEFWEB_APPNAME after requesting one at apidoc.reliefweb.int — the adapter is implemented but inactive by default."
          : "Disabled by default in the source registry.";
    return { id: c.id, name: c.name, homepage: c.homepage, reason };
  });
}
